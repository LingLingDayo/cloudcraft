import type { GameState, DebugMetrics, GameMode, Language, HotbarItem, BlockType } from '@type';
export type { HotbarItem } from '@type';

export interface GameSlice {
  gameState: GameState;
  renderDistance: number;
  fov: number;
  gameMode: GameMode;
  language: Language;
  autoJump: boolean;
  miningProgress: number | null;
  setGameState: (state: GameState) => void;
  setRenderDistance: (dist: number) => void;
  setFov: (fov: number) => void;
  setGameMode: (mode: GameMode) => void;
  setLanguage: (lang: Language) => void;
  setAutoJump: (autoJump: boolean) => void;
  setMiningProgress: (progress: number | null) => void;
}

export interface PlayerSlice {
  selectedBlock: BlockType;
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
  setSelectedBlock: (block: BlockType) => void;
  setActiveSlot: (slot: number) => void;
  addToHotbar: (blockType: BlockType, count?: number) => boolean;
  decrementHotbarItem: (slotIndex: number) => void;
  resetHotbar: (mode: GameMode) => void;
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
  quickMoveItem: (from: 'hotbar' | 'chest', index: number) => void;
}


export interface DebugSlice {
  debugOverlay: boolean;
  debugMetrics: DebugMetrics | null;
  setDebugOverlay: (visible: boolean) => void;
  setDebugMetrics: (metrics: DebugMetrics | null) => void;
}

export type GameStoreState = GameSlice & PlayerSlice & DebugSlice;
