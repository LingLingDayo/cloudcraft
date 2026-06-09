import type { StateCreator } from 'zustand';
import type { GameStoreState, DebugSlice } from '../types';
import { getSystemSettings, saveSystemSetting } from '@utils/settings';

export const createDebugSlice: StateCreator<
  GameStoreState,
  [],
  [],
  DebugSlice
> = (set) => {
  const settings = getSystemSettings();

  return {
    debugOverlay: settings.debugOverlay,
    debugMetrics: null,

    setDebugOverlay: (debugOverlay) => set(() => {
      saveSystemSetting('debugOverlay', debugOverlay);
      return { debugOverlay };
    }),
    setDebugMetrics: (debugMetrics) => set({ debugMetrics }),
  };
};
