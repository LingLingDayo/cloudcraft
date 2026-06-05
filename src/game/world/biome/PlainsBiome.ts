import { type Biome, type GrowTreeFn, TreeStyle, getOreType } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { WORLD_CONFIG } from '../WorldConfig';

export class PlainsBiome implements Biome {
  public id = 'plains';
  public name = '平原';

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 极其平缓，利用低频 fbm 控制轻微波动，比海平面(150)高出约 1-10 格
    return Math.floor(155 + noise.fbm(wx * 0.01, wz * 0.01, 2, 0.4) * 4);
  }

  public fillColumn(
    chunk: Uint8Array,
    lx: number,
    lz: number,
    y: number,
    finalHeight: number,
    waterLevel: number,
    depthBelowSurface: number,
    noise: ImprovedNoise,
    wx: number,
    wz: number,
    isDryLand: boolean
  ): void {
    const index = lx + lz * 16 + (y % 16) * 256;
    if (y === finalHeight) {
      if (y < waterLevel + 2 && !isDryLand) {
        chunk[index] = BLOCK_TYPES.SAND;
      } else {
        chunk[index] = BLOCK_TYPES.GRASS;
      }
    } else if (depthBelowSurface <= 4) {
      if (y < waterLevel + 2 && !isDryLand) {
        chunk[index] = BLOCK_TYPES.SAND;
      } else {
        chunk[index] = BLOCK_TYPES.DIRT;
      }
    } else {
      chunk[index] = getOreType(y, WORLD_CONFIG.oreGeneration.default, BLOCK_TYPES.STONE, noise, wx, wz);
    }
  }


  public getTreeProbability(_chunkRandom: number): number {
    // 平原树木极少
    return 0.04;
  }

  public growDecorations(
    chunk: Uint8Array,
    tx: number,
    ty: number,
    tz: number,
    chunkRandom: number,
    treeIndex: number,
    growTree: GrowTreeFn
  ): void {
    // 平原仅长橡树，且高度适中
    const seed = chunkRandom * 10 + treeIndex;
    const heightRand = (Math.sin(seed * 789.012) * 43758.5453) % 1;
    const absHeight = Math.abs(heightRand);
    const treeHeight = 4 + Math.floor(absHeight * 2); // 4 to 5
    growTree(chunk, tx, ty, tz, BLOCK_TYPES.WOOD, BLOCK_TYPES.LEAF, treeHeight, TreeStyle.OAK);
  }

  public getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number {
    const r = noise.pseudoRandom2d(wx, wz);
    // 16% 概率生成植被
    if (r < 0.16) {
      if (r < 0.136) {
        return BLOCK_TYPES.TALL_GRASS;
      } else if (r < 0.152) {
        return BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM;
      } else if (r < 0.1568) {
        const flowers = [BLOCK_TYPES.DANDELION, BLOCK_TYPES.POPPY, BLOCK_TYPES.OXEYE_DAISY];
        const idx = Math.floor((r - 0.152) * 625) % flowers.length;
        return flowers[idx];
      } else {
        return BLOCK_TYPES.SUNFLOWER_BOTTOM;
      }
    }
    return BLOCK_TYPES.AIR;
  }
}
