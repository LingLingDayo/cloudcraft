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
  autoJump: typeof localStorage !== 'undefined' ? localStorage.getItem('minicraft_auto_jump') !== 'false' : true,
  miningProgress: null,
  isSettingsOpen: false,
  settingsSource: null,

  // Initial loading states
  isWorldLoading: false,
  worldLoadingProgress: 0,
  worldLoadingStage: 'engine',
  chunkLoadingStates: {},

  setGameState: (gameState) => set({ gameState }),
  setIsSettingsOpen: (isSettingsOpen, settingsSource = null) => set({ isSettingsOpen, settingsSource }),
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
  setAutoJump: (autoJump) => set(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('minicraft_auto_jump', String(autoJump));
    }
    return { autoJump };
  }),
  setMiningProgress: (miningProgress) => set({ miningProgress }),

  // Loading actions implementation
  setWorldLoading: (isWorldLoading) => set({ isWorldLoading }),
  setWorldLoadingProgress: (worldLoadingProgress) => set({ worldLoadingProgress }),
  setWorldLoadingStage: (worldLoadingStage) => set({ worldLoadingStage }),
  setChunkLoadingState: (key, loaded) => set((state) => {
    const newStates = { ...state.chunkLoadingStates, [key]: loaded };
    
    // Calculate progress based on chunk loading
    const keys = Object.keys(newStates);
    const total = keys.length;
    const loadedCount = keys.filter((k) => newStates[k]).length;
    
    let progress = state.worldLoadingProgress;
    if (state.worldLoadingStage === 'chunks' && total > 0) {
      // Chunk generation progress maps from 30% to 100%
      progress = Math.round(30 + (loadedCount / total) * 70);
    }
    
    return {
      chunkLoadingStates: newStates,
      worldLoadingProgress: progress
    };
  }),
  initChunkLoading: (keys) => set(() => {
    const states: Record<string, boolean> = {};
    keys.forEach((k) => {
      states[k] = false;
    });
    return {
      chunkLoadingStates: states,
      // If initializing keys, we set starting progress to 30%
      worldLoadingProgress: keys.length > 0 ? 30 : 0
    };
  }),
});

