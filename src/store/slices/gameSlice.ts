import type { StateCreator } from 'zustand';
import type { GameStoreState, GameSlice } from '../types';
import { BLOCK_TYPES } from '@game/world/BlockConfig';
import { GameState, GameMode, type Language } from '@type';

export const createGameSlice: StateCreator<
  GameStoreState,
  [],
  [],
  GameSlice
> = (set) => ({
  gameState: GameState.MENU,
  renderDistance: 3,
  fov: 75,
  gameMode: GameMode.ADVENTURE,
  language: (typeof localStorage !== 'undefined' ? localStorage.getItem('minicraft_language') as Language : 'zh') || 'zh',

  setGameState: (gameState) => set({ gameState }),
  setRenderDistance: (renderDistance) => set({ renderDistance }),
  setFov: (fov) => set({ fov }),
  setGameMode: (gameMode) => set(() => {
    if (gameMode === GameMode.CREATIVE) {
      return {
        gameMode,
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
        gameMode,
        hotbar: Array(9).fill(null),
        activeSlot: 0,
        selectedBlock: BLOCK_TYPES.AIR,
      };
    }
  }),
  setLanguage: (language) => set(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('minicraft_language', language);
    }
    return { language };
  }),
});

