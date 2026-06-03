export const BlockType = {
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
  CHEST: 13,
  LEVER: 14,
  BIRCH_WOOD: 15,
  BIRCH_LEAVES: 16,
  SPRUCE_WOOD: 17,
  SPRUCE_LEAVES: 18,
} as const;
export type BlockType = typeof BlockType[keyof typeof BlockType];

export const BLOCK_TYPES = BlockType;
