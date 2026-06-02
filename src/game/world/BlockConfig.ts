export const BLOCK_TYPES = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAF: 5,
  BRICK: 6,
  GLASS: 7,
  WATER: 8,
  SAND: 9,
  COAL: 10,
  IRON: 11,
  DIAMOND: 12,
};

// Mapping each block type's top, bottom, and side faces to tile indices in the 4x4 atlas grid (0 to 15)
export const BLOCK_FACES: Record<number, { top: number; bottom: number; side: number }> = {
  [BLOCK_TYPES.GRASS]: { top: 0, bottom: 2, side: 1 },
  [BLOCK_TYPES.DIRT]: { top: 2, bottom: 2, side: 2 },
  [BLOCK_TYPES.STONE]: { top: 3, bottom: 3, side: 3 },
  [BLOCK_TYPES.WOOD]: { top: 5, bottom: 5, side: 4 },
  [BLOCK_TYPES.LEAF]: { top: 6, bottom: 6, side: 6 },
  [BLOCK_TYPES.BRICK]: { top: 7, bottom: 7, side: 7 },
  [BLOCK_TYPES.GLASS]: { top: 8, bottom: 8, side: 8 },
  [BLOCK_TYPES.WATER]: { top: 9, bottom: 9, side: 9 },
  [BLOCK_TYPES.SAND]: { top: 10, bottom: 10, side: 10 },
  [BLOCK_TYPES.COAL]: { top: 11, bottom: 11, side: 11 },
  [BLOCK_TYPES.IRON]: { top: 12, bottom: 12, side: 12 },
  [BLOCK_TYPES.DIAMOND]: { top: 13, bottom: 13, side: 13 },
};
