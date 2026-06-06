import { type Biome, TreeStyle } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { TreeStructureGenerator, type BlockWriter } from '../TreeStructureGenerator';

export class TaigaBiome implements Biome {
  public id = 'taiga';
  public name = '针叶林';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.15, targetMoisture = 0.7) {
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
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
    isDryLand: boolean,
    slope: number
  ): void {
    const index = lx + lz * 16 + (y % 16) * 256;
    if (y === finalHeight) {
      if (slope > 3.0) {
        chunk[index] = BLOCK_TYPES.STONE; // 陡坡裸岩
      } else if (y < waterLevel + 2 && !isDryLand) {
        chunk[index] = BLOCK_TYPES.SAND;
      } else {
        chunk[index] = BLOCK_TYPES.GRASS;
      }
    } else if (depthBelowSurface <= 4) {
      if (slope > 3.0) {
        chunk[index] = BLOCK_TYPES.STONE;
      } else if (y < waterLevel + 2 && !isDryLand) {
        chunk[index] = BLOCK_TYPES.SAND;
      } else {
        chunk[index] = BLOCK_TYPES.DIRT;
      }
    } else {
      chunk[index] = BLOCK_TYPES.STONE;
    }
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.3; // 针叶林树木稍微密集一些
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
    const seed = chunkRandom * 20 + treeIndex;
    const heightRand = (Math.sin(seed * 543.21) * 43758.5453) % 1;
    const absHeight = Math.abs(heightRand);
    const treeHeight = 6 + Math.floor(absHeight * 3); // 6 to 8

    // 只生成松木/云杉
    TreeStructureGenerator.growTree(
      writer,
      wx,
      wy,
      wz,
      BLOCK_TYPES.SPRUCE_WOOD,
      BLOCK_TYPES.SPRUCE_LEAVES,
      treeHeight,
      TreeStyle.SPRUCE,
      (wlx, wly, wlz) => noise.pseudoRandom2d(wlx * 17 + wx, wlz * 23 + wz + wly)
    );
  }

  public getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number {
    const r = noise.pseudoRandom2d(wx, wz);
    // 8% 概率生成植被
    if (r < 0.08) {
      if (r < 0.048) {
        return BLOCK_TYPES.FERN;
      } else {
        return BLOCK_TYPES.TALL_GRASS;
      }
    }
    return BLOCK_TYPES.AIR;
  }
}
