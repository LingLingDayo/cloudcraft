import type { StateCreator } from 'zustand';
import type { GameStoreState, DebugSlice } from '../types';

export const createDebugSlice: StateCreator<
  GameStoreState,
  [],
  [],
  DebugSlice
> = (set) => ({
  debugOverlay: false,
  debugMetrics: null,

  setDebugOverlay: (debugOverlay) => set({ debugOverlay }),
  setDebugMetrics: (debugMetrics) => set({ debugMetrics }),
});
