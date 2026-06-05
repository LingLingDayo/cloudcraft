import type { StateCreator } from 'zustand';
import type { GameStoreState, GameSlice } from '../types';
import { GameState, GameMode, ItemType } from '@type';
import { CREATIVE_DEFAULT_HOTBAR } from './playerSlice';
import { getSystemSettings, saveSystemSetting } from '@utils/settings';

export const createGameSlice: StateCreator<
  GameStoreState,
  [],
  [],
  GameSlice
> = (set) => {
  const settings = getSystemSettings();

  return {
    gameState: GameState.MENU,
    renderDistance: 3,
    fov: 75,
    gameMode: GameMode.ADVENTURE,
    language: settings.language,
    autoJump: settings.autoJump,
    dpadSize: settings.dpadSize,
    miningProgress: null,
    showMinimap: settings.showMinimap,
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
          hotbar: [...CREATIVE_DEFAULT_HOTBAR],
          activeSlot: 0,
          selectedItem: ItemType.GRASS,
        };
      } else {
        return {
          gameMode,
          hotbar: Array(9).fill(null),
          activeSlot: 0,
          selectedItem: null,
        };
      }
    }),
    setLanguage: (language) => set(() => {
      saveSystemSetting('language', language);
      return { language };
    }),
    setAutoJump: (autoJump) => set(() => {
      saveSystemSetting('autoJump', autoJump);
      return { autoJump };
    }),
    setDpadSize: (dpadSize) => set(() => {
      saveSystemSetting('dpadSize', dpadSize);
      return { dpadSize };
    }),
    setMiningProgress: (miningProgress) => set({ miningProgress }),
    setShowMinimap: (showMinimap) => set(() => {
      saveSystemSetting('showMinimap', showMinimap);
      return { showMinimap };
    }),

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
  };
};

