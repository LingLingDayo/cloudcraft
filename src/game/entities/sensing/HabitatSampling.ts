import { BLOCK_TYPES } from '@type';
import type { World } from '@game/world/World';

/** 计入“植被/树木密度”的方块：原木、树叶、树苗与地表植株。 */
const VEGETATION_BLOCK_IDS: ReadonlySet<number> = new Set([
  BLOCK_TYPES.WOOD,
  BLOCK_TYPES.BIRCH_WOOD,
  BLOCK_TYPES.SPRUCE_WOOD,
  BLOCK_TYPES.JUNGLE_WOOD,
  BLOCK_TYPES.LEAF,
  BLOCK_TYPES.BIRCH_LEAVES,
  BLOCK_TYPES.SPRUCE_LEAVES,
  BLOCK_TYPES.JUNGLE_LEAVES,
  BLOCK_TYPES.OAK_SAPLING,
  BLOCK_TYPES.BIRCH_SAPLING,
  BLOCK_TYPES.SPRUCE_SAPLING,
  BLOCK_TYPES.JUNGLE_SAPLING,
  BLOCK_TYPES.DANDELION,
  BLOCK_TYPES.POPPY,
  BLOCK_TYPES.BLUE_ORCHID,
  BLOCK_TYPES.ALLIUM,
  BLOCK_TYPES.OXEYE_DAISY,
  BLOCK_TYPES.TALL_GRASS,
  BLOCK_TYPES.FERN,
  BLOCK_TYPES.SUNFLOWER_BOTTOM,
  BLOCK_TYPES.SUNFLOWER_TOP,
  BLOCK_TYPES.ROSE_BUSH_BOTTOM,
  BLOCK_TYPES.ROSE_BUSH_TOP,
  BLOCK_TYPES.PEONY_BOTTOM,
  BLOCK_TYPES.PEONY_TOP,
  BLOCK_TYPES.LILAC_BOTTOM,
  BLOCK_TYPES.LILAC_TOP,
  BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM,
  BLOCK_TYPES.DOUBLE_TALL_GRASS_TOP,
  BLOCK_TYPES.CACTUS,
]);

const DEFAULT_RADIUS = 4;
const DEFAULT_VERTICAL_RANGE = 5;

export function isVegetationBlock(blockId: number): boolean {
  return VEGETATION_BLOCK_IDS.has(blockId);
}

/**
 * 在出生点附近采样局部植被密度（0–1）。
 * 以列为单位：该列在地表附近扫描到任一植被方块即记为命中。
 */
export function sampleLocalVegetationDensity(
  world: World,
  centerX: number,
  surfaceY: number,
  centerZ: number,
  radius = DEFAULT_RADIUS,
  verticalRange = DEFAULT_VERTICAL_RANGE,
): number {
  const originX = Math.floor(centerX);
  const originZ = Math.floor(centerZ);
  let hits = 0;
  let columns = 0;

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      columns++;
      const x = originX + dx;
      const z = originZ + dz;
      let found = false;
      for (let dy = -1; dy <= verticalRange; dy++) {
        if (isVegetationBlock(world.getBlock(x, surfaceY + dy, z))) {
          found = true;
          break;
        }
      }
      if (found) hits++;
    }
  }

  return columns === 0 ? 0 : hits / columns;
}

/** 局部采样与群系树概率混合，兼顾微观环境与 biome 倾向。 */
export function blendVegetationDensity(
  localDensity: number,
  biomeTreeProbability: number,
  localWeight = 0.75,
): number {
  const weight = Math.min(1, Math.max(0, localWeight));
  return localDensity * weight + biomeTreeProbability * (1 - weight);
}
