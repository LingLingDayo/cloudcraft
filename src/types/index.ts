export const GameState = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

export const GameMode = {
  ADVENTURE: 'adventure',
  CREATIVE: 'creative',
} as const;
export type GameMode = typeof GameMode[keyof typeof GameMode];

export const BlockType = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAF: 5,
  BRICK: 6,
  GLASS: 7,
  WATER: 8,
  SAND: 9,
  COAL: 10,
  IRON: 11,
  DIAMOND: 12,
  CHEST: 13,
  LEVER: 14,
} as const;
export type BlockType = typeof BlockType[keyof typeof BlockType];

export const BLOCK_TYPES = BlockType;

export const SoundType = {
  STONE: 'stone',
  GRASS: 'grass',
  WOOD: 'wood',
  SAND: 'sand',
  GLASS: 'glass',
  WATER: 'water',
  NONE: 'none',
} as const;
export type SoundType = typeof SoundType[keyof typeof SoundType];

export interface HotbarItem {
  type: BlockType;
  count: number;
}

export type Language = 'zh' | 'en';

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface DebugMetrics {
  fps: number;
  chunksLoaded: number;
  isFlying: boolean;
  targetBlock: {
    type: string;
    x: number;
    y: number;
    z: number;
  } | null;
}

export type HUDProps = Record<string, never>;

export interface StartMenuProps {
  onStartGame: (seed: string, renderDistance: number, fov: number, loadSave: boolean) => void;
}

export interface PauseMenuProps {
  onResume: () => void;
  onSave: () => void;
  onQuit: () => void;
}
