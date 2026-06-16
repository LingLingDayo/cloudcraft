import { create } from 'zustand';
import type { GameStoreState } from './types';
import { createGameSlice } from './slices/gameSlice';
import { createPlayerSlice } from './slices/playerSlice';
import { createDebugSlice } from './slices/debugSlice';

export type { GameStoreState, GameSlice, PlayerSlice, DebugSlice } from './types';

export const useGameStore = create<GameStoreState>()((...a) => ({
  ...createGameSlice(...a),
  ...createPlayerSlice(...a),
  ...createDebugSlice(...a),
}));

