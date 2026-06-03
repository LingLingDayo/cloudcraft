import type { Biome, GrowTreeFn } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class ForestBiome implements Biome {
  public id = 'forest';
  public name = '森林';

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    return Math.floor(noise.fbm(wx * 0.015, wz * 0.015, 3, 0.4) * 20 + 25);
  }

  public fillColumn(
    chunk: Uint8Array,
    lx: number,
    lz: number,
    y: number,
    finalHeight: number,
    waterLevel: number,
    depthBelowSurface: number
  ): void {
    const index = lx + lz * 16 + y * 256;
    if (y === finalHeight) {
      if (y < waterLevel + 2) {
        chunk[index] = BLOCK_TYPES.SAND;
      } else {
        chunk[index] = BLOCK_TYPES.GRASS;
      }
    } else if (depthBelowSurface <= 4) {
      if (y < waterLevel + 2) {
        chunk[index] = BLOCK_TYPES.SAND;
      } else {
        chunk[index] = BLOCK_TYPES.DIRT;
      }
    } else {
      // 矿石脉生成
      const r = Math.random();
      if (r < 0.01 && y < 15) {
        chunk[index] = BLOCK_TYPES.DIAMOND;
      } else if (r < 0.02 && y < 30) {
        chunk[index] = BLOCK_TYPES.IRON;
      } else if (r < 0.04 && y < 45) {
        chunk[index] = BLOCK_TYPES.COAL;
      } else {
        chunk[index] = BLOCK_TYPES.STONE;
      }
    }
  }

  public getTreeProbability(_chunkRandom: number): number {
    // 25% 概率在区块内长树，并在区块内长 1~3 棵
    return 0.25;
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
    // 森林内橡树（45%）、白桦（55%）
    // 为了使噪波决定伪随机值，我们基于 tx, tz 和 treeIndex 构造一些伪随机数
    const seed = chunkRandom * 10 + treeIndex;
    const treeTypeVal = (Math.sin(seed * 123.456) * 43758.5453) % 1;
    const heightRand = (Math.sin(seed * 789.012) * 43758.5453) % 1;
    const absType = Math.abs(treeTypeVal);
    const absHeight = Math.abs(heightRand);

    if (absType < 0.45) {
      // Oak tree
      const treeHeight = 4 + Math.floor(absHeight * 2);
      growTree(chunk, tx, ty, tz, BLOCK_TYPES.WOOD, BLOCK_TYPES.LEAF, treeHeight, 'oak');
    } else {
      // Birch tree
      const treeHeight = 5 + Math.floor(absHeight * 3);
      growTree(chunk, tx, ty, tz, BLOCK_TYPES.BIRCH_WOOD, BLOCK_TYPES.BIRCH_LEAVES, treeHeight, 'birch');
    }
  }
}
