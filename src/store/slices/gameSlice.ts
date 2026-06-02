import type { StateCreator } from 'zustand';
import type { GameStoreState, GameSlice } from '../types';

export const createGameSlice: StateCreator<
  GameStoreState,
  [],
  [],
  GameSlice
> = (set) => ({
  gameState: 'MENU',
  renderDistance: 3,
  fov: 75,

  setGameState: (gameState) => set({ gameState }),
  setRenderDistance: (renderDistance) => set({ renderDistance }),
  setFov: (fov) => set({ fov }),
});
