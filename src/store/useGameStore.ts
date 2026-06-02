import { create } from 'zustand';
import type { GameState, DebugMetrics } from '@type';
import { BLOCK_TYPES } from '@game/world/World';

interface GameStoreState {
  gameState: GameState;
  selectedBlock: number;
  life: number;
  position: { x: number; y: number; z: number };
  onGround: boolean;
  inWater: boolean;
  debugOverlay: boolean;
  debugMetrics: DebugMetrics | null;
  isDamaged: boolean;
  renderDistance: number;
  fov: number;

  // Actions
  setGameState: (state: GameState) => void;
  setSelectedBlock: (block: number) => void;
  setLife: (life: number) => void;
  setPlayerState: (
    position: { x: number; y: number; z: number },
    onGround: boolean,
    inWater: boolean,
    life?: number
  ) => void;
  setDebugOverlay: (visible: boolean) => void;
  setDebugMetrics: (metrics: DebugMetrics | null) => void;
  setIsDamaged: (damaged: boolean) => void;
  setRenderDistance: (dist: number) => void;
  setFov: (fov: number) => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  gameState: 'MENU',
  selectedBlock: BLOCK_TYPES.GRASS,
  life: 10,
  position: { x: 8.5, y: 40, z: 8.5 },
  onGround: false,
  inWater: false,
  debugOverlay: false,
  debugMetrics: null,
  isDamaged: false,
  renderDistance: 3,
  fov: 75,

  setGameState: (gameState) => set({ gameState }),
  setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
  setLife: (life) => set({ life }),
  setPlayerState: (position, onGround, inWater, life) =>
    set((state) => ({
      position,
      onGround,
      inWater,
      life: life !== undefined ? life : state.life,
    })),
  setDebugOverlay: (debugOverlay) => set({ debugOverlay }),
  setDebugMetrics: (debugMetrics) => set({ debugMetrics }),
  setIsDamaged: (isDamaged) => set({ isDamaged }),
  setRenderDistance: (renderDistance) => set({ renderDistance }),
  setFov: (fov) => set({ fov }),
}));
