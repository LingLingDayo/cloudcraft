import { type Biome, type GrowTreeFn, TreeStyle } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class JungleBiome implements Biome {
  public id = 'jungle';
  public name = '丛林';

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 丛林地表稍有起伏
    return Math.floor(26 + noise.fbm(wx * 0.02, wz * 0.02, 3, 0.4) * 12);
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
      // 矿石脉
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
    return 0.4; // 繁茂的丛林，树木极多
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
    const seed = chunkRandom * 40 + treeIndex;
    const heightRand = (Math.sin(seed * 432.1) * 43758.5453) % 1;
    const absHeight = Math.abs(heightRand);
    // 树木很高：7 到 11 格
    const treeHeight = 7 + Math.floor(absHeight * 5);

    growTree(chunk, tx, ty, tz, BLOCK_TYPES.JUNGLE_WOOD, BLOCK_TYPES.JUNGLE_LEAVES, treeHeight, TreeStyle.JUNGLE);
  }
}
