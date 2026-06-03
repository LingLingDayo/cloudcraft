export const SoundType = {
  STONE: 'stone',
  GRASS: 'grass',
  WOOD: 'wood',
  SAND: 'sand',
  GLASS: 'glass',
  WATER: 'water',
  NONE: 'none',
} as const;
export type SoundType = typeof SoundType[keyof typeof SoundType];
