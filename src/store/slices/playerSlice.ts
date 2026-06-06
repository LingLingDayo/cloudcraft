import type { StateCreator } from 'zustand';
import type { GameStoreState, PlayerSlice } from '../types';
import { BLOCK_TYPES } from '@game/world/World';
import { GameMode, ItemType, BlockType } from '@type';
import { ItemRegistry } from '@game/item/ItemRegistry';
import type { HotbarItem } from '../types';

/** 创意模式默认热键栏配置，统一维护避免两处重复 */
export const CREATIVE_DEFAULT_HOTBAR: HotbarItem[] = [
  { type: ItemType.GRASS, count: 1 },
  { type: ItemType.DIRT, count: 1 },
  { type: ItemType.STONE, count: 1 },
  { type: ItemType.WOOD, count: 1 },
  { type: ItemType.LEAF, count: 1 },
  { type: ItemType.GLASS, count: 1 },
  { type: ItemType.WATER, count: 1 },
  { type: ItemType.SAND, count: 1 },
  { type: ItemType.DIAMOND, count: 1 },
];

/** 派生查询：当前手持物品对应的 BlockType（无则返回 AIR） */
export function getSelectedBlockType(state: { selectedItem: ItemType | null }): BlockType {
  if (!state.selectedItem) return BLOCK_TYPES.AIR;
  return ItemRegistry.getBlockTypeFromItemType(state.selectedItem);
}

export const createPlayerSlice: StateCreator<
  GameStoreState,
  [],
  [],
  PlayerSlice
> = (set) => ({
  selectedItem: null,
  activeSlot: 0,
  hotbar: Array(9).fill(null),
  life: 10,
  hunger: 20,
  position: { x: 8.5, y: 40, z: 8.5 },
  onGround: false,
  inWater: false,
  isDamaged: false,
  activeChest: null,
  chestInventory: [],
  isInventoryOpen: false,
  inventory: Array(54).fill(null),


  setSelectedItem: (selectedItem) => set(() => ({
    selectedItem,
  })),
  
  setActiveSlot: (activeSlot) => set((state) => {
    const item = state.hotbar[activeSlot];
    const selectedItem = item ? item.type : null;
    return { activeSlot, selectedItem };
  }),

  addToHotbar: (itemType, count = 1) => {
    let success = false;
    set((state) => {
      if (state.gameMode === GameMode.CREATIVE) {
        return {};
      }

      const nextHotbar = [...state.hotbar];
      const nextInventory = [...(state.inventory || Array(54).fill(null))];
      const maxStackSize = ItemRegistry.get(itemType).maxStackSize;
      let remaining = count;

      // 1. Try to merge into existing slots in hotbar
      for (let i = 0; i < nextHotbar.length; i++) {
        const item = nextHotbar[i];
        if (item && item.type === itemType && item.count < maxStackSize) {
          const canFit = maxStackSize - item.count;
          const toAdd = Math.min(remaining, canFit);
          nextHotbar[i] = { ...item, count: item.count + toAdd };
          remaining -= toAdd;
          if (remaining <= 0) break;
        }
      }

      // 2. Try to merge into existing slots in inventory
      if (remaining > 0) {
        for (let i = 0; i < nextInventory.length; i++) {
          const item = nextInventory[i];
          if (item && item.type === itemType && item.count < maxStackSize) {
            const canFit = maxStackSize - item.count;
            const toAdd = Math.min(remaining, canFit);
            nextInventory[i] = { ...item, count: item.count + toAdd };
            remaining -= toAdd;
            if (remaining <= 0) break;
          }
        }
      }

      // 3. Try to place in empty hotbar slots
      if (remaining > 0) {
        for (let i = 0; i < nextHotbar.length; i++) {
          if (nextHotbar[i] === null) {
            const toAdd = Math.min(remaining, maxStackSize);
            nextHotbar[i] = { type: itemType, count: toAdd };
            remaining -= toAdd;
            if (remaining <= 0) break;
          }
        }
      }

      // 4. Try to place in empty inventory slots
      if (remaining > 0) {
        for (let i = 0; i < nextInventory.length; i++) {
          if (nextInventory[i] === null) {
            const toAdd = Math.min(remaining, maxStackSize);
            nextInventory[i] = { type: itemType, count: toAdd };
            remaining -= toAdd;
            if (remaining <= 0) break;
          }
        }
      }

      if (remaining < count) {
        success = true;
        const activeItem = nextHotbar[state.activeSlot];
        const selectedItem = activeItem ? activeItem.type : null;
        return { hotbar: nextHotbar, inventory: nextInventory, selectedItem };
      }
      return {};
    });
    return success;
  },

  decrementHotbarItem: (slotIndex) => set((state) => {
    if (state.gameMode === GameMode.CREATIVE) {
      return {};
    }
    const nextHotbar = [...state.hotbar];
    const item = nextHotbar[slotIndex];
    if (item) {
      if (item.count > 1) {
        nextHotbar[slotIndex] = { ...item, count: item.count - 1 };
      } else {
        nextHotbar[slotIndex] = null;
      }
      const activeItem = nextHotbar[state.activeSlot];
      const selectedItem = activeItem ? activeItem.type : null;
      return { hotbar: nextHotbar, selectedItem };
    }
    return {};
  }),

  resetHotbar: (mode) => set(() => {
    if (mode === GameMode.CREATIVE) {
      return {
        hotbar: [...CREATIVE_DEFAULT_HOTBAR],
        activeSlot: 0,
        selectedItem: ItemType.GRASS,
        inventory: Array(54).fill(null),
      };
    } else {
      return {
        hotbar: Array(9).fill(null),
        activeSlot: 0,
        selectedItem: null,
        inventory: Array(54).fill(null),
      };
    }
  }),

  setLife: (life) => set({ life }),
  setPlayerState: (position, onGround, inWater, life, hunger) =>
    set((state) => ({
      position,
      onGround,
      inWater,
      life: life !== undefined ? life : state.life,
      hunger: hunger !== undefined ? hunger : state.hunger,
    })),
  setIsDamaged: (isDamaged) => set({ isDamaged }),

  openChest: (x, y, z, items) => {
    set({
      activeChest: { x, y, z },
      chestInventory: items.map(item => item ? { ...item } : null)
    });
  },

  closeChest: () => {
    set({
      activeChest: null,
      chestInventory: []
    });
  },

  openInventory: () => {
    set({ isInventoryOpen: true });
  },

  closeInventory: () => {
    set({ isInventoryOpen: false });
  },

  toggleInventory: () => set((state) => {
    return { isInventoryOpen: !state.isInventoryOpen };
  }),

  setInventory: (inventory) => set({ inventory }),

  quickMoveItem: (from, index) => {
    set((state) => {
      const nextHotbar = [...state.hotbar];
      const nextChest = [...state.chestInventory];

      if (from === 'hotbar') {
        const item = nextHotbar[index];
        if (!item) return {};
        const emptyIndex = nextChest.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
          nextChest[emptyIndex] = { ...item };
          nextHotbar[index] = null;
        }
      } else {
        const item = nextChest[index];
        if (!item) return {};
        const emptyIndex = nextHotbar.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
          nextHotbar[emptyIndex] = { ...item };
          nextChest[index] = null;
        }
      }

      return {
        hotbar: nextHotbar,
        chestInventory: nextChest
      };
    });
  }
});
