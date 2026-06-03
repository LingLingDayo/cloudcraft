import type { StateCreator } from 'zustand';
import type { GameStoreState, PlayerSlice } from '../types';
import { BLOCK_TYPES } from '@game/world/World';

export const createPlayerSlice: StateCreator<
  GameStoreState,
  [],
  [],
  PlayerSlice
> = (set) => ({
  selectedBlock: BLOCK_TYPES.AIR,
  activeSlot: 0,
  hotbar: Array(9).fill(null),
  life: 10,
  position: { x: 8.5, y: 40, z: 8.5 },
  onGround: false,
  inWater: false,
  isDamaged: false,
  activeChest: null,
  chestInventory: [],


  setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
  
  setActiveSlot: (activeSlot) => set((state) => {
    const item = state.hotbar[activeSlot];
    const selectedBlock = item ? item.type : BLOCK_TYPES.AIR;
    return { activeSlot, selectedBlock };
  }),

  addToHotbar: (blockType, count = 1) => {
    let success = false;
    set((state) => {
      if (state.gameMode === 'creative') {
        return {};
      }

      const nextHotbar = [...state.hotbar];
      
      const existingIndex = nextHotbar.findIndex(item => item && item.type === blockType);
      if (existingIndex !== -1) {
        const item = nextHotbar[existingIndex]!;
        nextHotbar[existingIndex] = { ...item, count: item.count + count };
        success = true;
      } else {
        const emptyIndex = nextHotbar.findIndex(item => item === null);
        if (emptyIndex !== -1) {
          nextHotbar[emptyIndex] = { type: blockType, count };
          success = true;
        }
      }

      if (success) {
        const activeItem = nextHotbar[state.activeSlot];
        const selectedBlock = activeItem ? activeItem.type : BLOCK_TYPES.AIR;
        return { hotbar: nextHotbar, selectedBlock };
      }
      return {};
    });
    return success;
  },

  decrementHotbarItem: (slotIndex) => set((state) => {
    if (state.gameMode === 'creative') {
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
      const selectedBlock = activeItem ? activeItem.type : BLOCK_TYPES.AIR;
      return { hotbar: nextHotbar, selectedBlock };
    }
    return {};
  }),

  resetHotbar: (mode) => set(() => {
    if (mode === 'creative') {
      return {
        hotbar: [
          { type: BLOCK_TYPES.GRASS, count: 1 },
          { type: BLOCK_TYPES.DIRT, count: 1 },
          { type: BLOCK_TYPES.STONE, count: 1 },
          { type: BLOCK_TYPES.WOOD, count: 1 },
          { type: BLOCK_TYPES.LEAF, count: 1 },
          { type: BLOCK_TYPES.GLASS, count: 1 },
          { type: BLOCK_TYPES.WATER, count: 1 },
          { type: BLOCK_TYPES.SAND, count: 1 },
          { type: BLOCK_TYPES.DIAMOND, count: 1 },
        ],
        activeSlot: 0,
        selectedBlock: BLOCK_TYPES.GRASS,
      };
    } else {
      return {
        hotbar: Array(9).fill(null),
        activeSlot: 0,
        selectedBlock: BLOCK_TYPES.AIR,
      };
    }
  }),

  setLife: (life) => set({ life }),
  setPlayerState: (position, onGround, inWater, life) =>
    set((state) => ({
      position,
      onGround,
      inWater,
      life: life !== undefined ? life : state.life,
    })),
  setIsDamaged: (isDamaged) => set({ isDamaged }),

  openChest: (x, y, z, items) => {
    // Release pointer lock to show cursor
    document.exitPointerLock?.();
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

  quickMoveItem: (from, index, onSyncToWorld) => {
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

      if (onSyncToWorld) {
        onSyncToWorld(nextChest);
      }

      return {
        hotbar: nextHotbar,
        chestInventory: nextChest
      };
    });
  }
});

