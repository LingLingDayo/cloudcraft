import type { GameState, DebugMetrics, GameMode, Language, HotbarItem, ItemType, Vector3D } from '@type';
import type { SystemSettings } from '@utils/settings';
export type { HotbarItem } from '@type';

export interface GameSlice {
  gameState: GameState;
  renderDistance: number;
  fov: number;
  gameMode: GameMode;
  language: Language;
  autoJump: boolean;
  dpadSize: number;
  miningProgress: number | null;
  showMinimap: boolean;
  
  isSettingsOpen: boolean;
  settingsSource: 'hud' | 'menu' | null;
  
  // Loading states
  isWorldLoading: boolean;
  worldLoadingProgress: number;
  worldLoadingStage: 'engine' | 'chunks';
  chunkLoadingStates: Record<string, boolean>;

  setGameState: (state: GameState) => void;
  setRenderDistance: (dist: number) => void;
  setFov: (fov: number) => void;
  setGameMode: (mode: GameMode) => void;
  setLanguage: (lang: Language) => void;
  setAutoJump: (autoJump: boolean) => void;
  setDpadSize: (size: number) => void;
  setMiningProgress: (progress: number | null) => void;
  setShowMinimap: (show: boolean) => void;
  setSetting: <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => void;
  setIsSettingsOpen: (open: boolean, source?: 'hud' | 'menu' | null) => void;
  
  // Loading actions
  setWorldLoading: (loading: boolean) => void;
  setWorldLoadingProgress: (progress: number) => void;
  setWorldLoadingStage: (stage: 'engine' | 'chunks') => void;
  setChunkLoadingState: (key: string, loaded: boolean) => void;
  initChunkLoading: (keys: string[]) => void;
}

export interface PlayerSlice {
  selectedItem: ItemType | null;
  activeSlot: number;
  hotbar: (HotbarItem | null)[];
  life: number;
  hunger: number;
  position: Vector3D;
  onGround: boolean;
  inWater: boolean;
  isDamaged: boolean;
  activeChest: Vector3D | null;
  chestInventory: (HotbarItem | null)[];
  isInventoryOpen: boolean;
  inventory: (HotbarItem | null)[];
  setSelectedItem: (item: ItemType | null) => void;
  setActiveSlot: (slot: number) => void;
  addToHotbar: (itemType: ItemType, count?: number) => boolean;
  decrementHotbarItem: (slotIndex: number) => void;
  resetHotbar: (mode: GameMode) => void;
  setLife: (life: number) => void;
  setPlayerState: (
    position: Vector3D,
    onGround: boolean,
    inWater: boolean,
    life?: number,
    hunger?: number
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
