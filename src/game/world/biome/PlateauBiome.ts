import { type Biome, type GrowTreeFn, TreeStyle, getOreType } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { WORLD_CONFIG } from '../WorldConfig';

export class PlateauBiome implements Biome {
  public id = 'plateau';
  public name = '高原';

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 基础高度 190 左右，利用 smoothstep 实现平坦高台
    const rawNoise = noise.fbm(wx * 0.012, wz * 0.012, 3, 0.4); // -1 to 1
    const t = Math.max(0, Math.min(1, (rawNoise + 0.15) / 0.8));
    const smoothT = t * t * (3 - 2 * t);
    return Math.floor(190 + smoothT * 40);
  }

  public fillColumn(
    chunk: Uint8Array,
    lx: number,
    lz: number,
    y: number,
    finalHeight: number,
    waterLevel: number,
    depthBelowSurface: number,
    _noise: ImprovedNoise,
    _wx: number,
    _wz: number,
    isDryLand: boolean
  ): void {
    const index = lx + lz * 16 + y * 256;
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
      // 矿脉
      chunk[index] = getOreType(y, WORLD_CONFIG.oreGeneration.default, BLOCK_TYPES.STONE);
    }
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.15; // 高原植物较少
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
    const seed = chunkRandom * 50 + treeIndex;
    const treeTypeVal = (Math.sin(seed * 234.56) * 43758.5453) % 1;
    const heightRand = (Math.sin(seed * 678.9) * 43758.5453) % 1;
    const absType = Math.abs(treeTypeVal);
    const absHeight = Math.abs(heightRand);

    if (absType < 0.5) {
      const treeHeight = 4 + Math.floor(absHeight * 2);
      growTree(chunk, tx, ty, tz, BLOCK_TYPES.WOOD, BLOCK_TYPES.LEAF, treeHeight, TreeStyle.OAK);
    } else {
      const treeHeight = 5 + Math.floor(absHeight * 3);
      growTree(chunk, tx, ty, tz, BLOCK_TYPES.BIRCH_WOOD, BLOCK_TYPES.BIRCH_LEAVES, treeHeight, TreeStyle.BIRCH);
    }
  }
}
