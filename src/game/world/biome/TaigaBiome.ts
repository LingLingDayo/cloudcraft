import type { Biome, GrowTreeFn } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class TaigaBiome implements Biome {
  public id = 'taiga';
  public name = '针叶林';

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    return Math.floor(noise.fbm(wx * 0.015, wz * 0.015, 3, 0.4) * 18 + 28);
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
    return 0.3; // 针叶林树木稍微密集一些
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
    const seed = chunkRandom * 20 + treeIndex;
    const heightRand = (Math.sin(seed * 543.21) * 43758.5453) % 1;
    const absHeight = Math.abs(heightRand);
    const treeHeight = 6 + Math.floor(absHeight * 3); // 6 to 8

    // 只生成松木/云杉
    growTree(chunk, tx, ty, tz, BLOCK_TYPES.SPRUCE_WOOD, BLOCK_TYPES.SPRUCE_LEAVES, treeHeight, 'spruce');
  }
}
