import type { GameState, DebugMetrics, GameMode } from '@type';

export interface GameSlice {
  gameState: GameState;
  renderDistance: number;
  fov: number;
  gameMode: GameMode;
  language: 'zh' | 'en';
  setGameState: (state: GameState) => void;
  setRenderDistance: (dist: number) => void;
  setFov: (fov: number) => void;
  setGameMode: (mode: GameMode) => void;
  setLanguage: (lang: 'zh' | 'en') => void;
}


export interface HotbarItem {
  type: number;
  count: number;
}

export interface PlayerSlice {
  selectedBlock: number;
  activeSlot: number;
  hotbar: (HotbarItem | null)[];
  life: number;
  position: { x: number; y: number; z: number };
  onGround: boolean;
  inWater: boolean;
  isDamaged: boolean;
  activeChest: { x: number; y: number; z: number } | null;
  chestInventory: (HotbarItem | null)[];
  isInventoryOpen: boolean;
  inventory: (HotbarItem | null)[];
  setSelectedBlock: (block: number) => void;
  setActiveSlot: (slot: number) => void;
  addToHotbar: (blockType: number, count?: number) => boolean;
  decrementHotbarItem: (slotIndex: number) => void;
  resetHotbar: (mode: 'adventure' | 'creative') => void;
  setLife: (life: number) => void;
  setPlayerState: (
    position: { x: number; y: number; z: number },
    onGround: boolean,
    inWater: boolean,
    life?: number
  ) => void;
  setIsDamaged: (damaged: boolean) => void;
  openChest: (x: number, y: number, z: number, items: (HotbarItem | null)[]) => void;
  closeChest: () => void;
  openInventory: () => void;
  closeInventory: () => void;
  toggleInventory: () => void;
  setInventory: (inventory: (HotbarItem | null)[]) => void;
  quickMoveItem: (from: 'hotbar' | 'chest', index: number, onSyncToWorld?: (items: (HotbarItem | null)[]) => void) => void;
}


export interface DebugSlice {
  debugOverlay: boolean;
  debugMetrics: DebugMetrics | null;
  setDebugOverlay: (visible: boolean) => void;
  setDebugMetrics: (metrics: DebugMetrics | null) => void;
}

export type GameStoreState = GameSlice & PlayerSlice & DebugSlice;
