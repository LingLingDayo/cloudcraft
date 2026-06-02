import type { GameState, DebugMetrics, GameMode } from '@type';

export interface GameSlice {
  gameState: GameState;
  renderDistance: number;
  fov: number;
  gameMode: GameMode;
  setGameState: (state: GameState) => void;
  setRenderDistance: (dist: number) => void;
  setFov: (fov: number) => void;
  setGameMode: (mode: GameMode) => void;
}


export interface PlayerSlice {
  selectedBlock: number;
  life: number;
  position: { x: number; y: number; z: number };
  onGround: boolean;
  inWater: boolean;
  isDamaged: boolean;
  setSelectedBlock: (block: number) => void;
  setLife: (life: number) => void;
  setPlayerState: (
    position: { x: number; y: number; z: number },
    onGround: boolean,
    inWater: boolean,
    life?: number
  ) => void;
  setIsDamaged: (damaged: boolean) => void;
}

export interface DebugSlice {
  debugOverlay: boolean;
  debugMetrics: DebugMetrics | null;
  setDebugOverlay: (visible: boolean) => void;
  setDebugMetrics: (metrics: DebugMetrics | null) => void;
}

export type GameStoreState = GameSlice & PlayerSlice & DebugSlice;
