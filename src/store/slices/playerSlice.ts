import type { StateCreator } from 'zustand';
import type { GameStoreState, PlayerSlice } from '../types';
import { BLOCK_TYPES } from '@game/world/World';

export const createPlayerSlice: StateCreator<
  GameStoreState,
  [],
  [],
  PlayerSlice
> = (set) => ({
  selectedBlock: BLOCK_TYPES.GRASS,
  life: 10,
  position: { x: 8.5, y: 40, z: 8.5 },
  onGround: false,
  inWater: false,
  isDamaged: false,

  setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
  setLife: (life) => set({ life }),
  setPlayerState: (position, onGround, inWater, life) =>
    set((state) => ({
      position,
      onGround,
      inWater,
      life: life !== undefined ? life : state.life,
    })),
  setIsDamaged: (isDamaged) => set({ isDamaged }),
});
