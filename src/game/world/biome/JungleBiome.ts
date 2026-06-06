import { type Biome, TreeStyle } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { TreeStructureGenerator, type BlockWriter } from '../TreeStructureGenerator';

export class JungleBiome implements Biome {
  public id = 'jungle';
  public name = '丛林';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.8, targetMoisture = 0.85) {
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
  }

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 丛林地表也比较平缓，比海平面(150)高出约 1-10 格
    return Math.floor(155 + noise.fbm(wx * 0.02, wz * 0.02, 2, 0.4) * 5);
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
      chunk[index] = BLOCK_TYPES.STONE;
    }
  }


  public getTreeProbability(_chunkRandom: number): number {
    return 0.4; // 繁茂的丛林，树木极多
  }

  public growDecorations(
    writer: BlockWriter,
    wx: number,
    wy: number,
    wz: number,
    chunkRandom: number,
    treeIndex: number,
    noise: ImprovedNoise
  ): void {
    const seed = chunkRandom * 40 + treeIndex;
    const heightRand = (Math.sin(seed * 432.1) * 43758.5453) % 1;
    const absHeight = Math.abs(heightRand);
    // 树木很高：7 到 11 格
    const treeHeight = 7 + Math.floor(absHeight * 5);

    TreeStructureGenerator.growTree(
      writer,
      wx,
      wy,
      wz,
      BLOCK_TYPES.JUNGLE_WOOD,
      BLOCK_TYPES.JUNGLE_LEAVES,
      treeHeight,
      TreeStyle.JUNGLE,
      (wlx, wly, wlz) => noise.pseudoRandom2d(wlx * 17 + wx, wlz * 23 + wz + wly)
    );
  }

  public getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number {
    const r = noise.pseudoRandom2d(wx, wz);
    // 18% 概率生成植被
    if (r < 0.18) {
      if (r < 0.09) {
        return BLOCK_TYPES.FERN;
      } else if (r < 0.162) {
        return BLOCK_TYPES.TALL_GRASS;
      } else {
        return BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM;
      }
    }
    return BLOCK_TYPES.AIR;
  }
}

