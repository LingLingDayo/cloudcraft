import { type Biome, TreeStyle } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { TreeStructureGenerator, type BlockWriter } from '../TreeStructureGenerator';

export class PlainsBiome implements Biome {
  public id = 'plains';
  public name = '平原';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.55, targetMoisture = 0.40) {
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
    return 0.04;
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
    const seed = chunkRandom * 10 + treeIndex;
    const heightRand = (Math.sin(seed * 789.012) * 43758.5453) % 1;
    const absHeight = Math.abs(heightRand);
    const treeHeight = 4 + Math.floor(absHeight * 2); // 4 to 5
    TreeStructureGenerator.growTree(
      writer,
      wx,
      wy,
      wz,
      BLOCK_TYPES.WOOD,
      BLOCK_TYPES.LEAF,
      treeHeight,
      TreeStyle.OAK,
      (wlx, wly, wlz) => noise.pseudoRandom2d(wlx * 17 + wx, wlz * 23 + wz + wly)
    );
  }

  public getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number {
    const r = noise.pseudoRandom2d(wx, wz);
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
