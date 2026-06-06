import { type Biome, TreeStyle, getOreType } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { WORLD_CONFIG } from '../WorldConfig';
import { TreeStructureGenerator, type BlockWriter } from '../TreeStructureGenerator';

export class PlateauBiome implements Biome {
  public id = 'plateau';
  public name = '高原';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.45, targetMoisture = 0.15) {
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
  }

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
      // 矿脉
      chunk[index] = getOreType(y, WORLD_CONFIG.oreGeneration.default, BLOCK_TYPES.STONE, noise, wx, wz);
    }
  }


  public getTreeProbability(_chunkRandom: number): number {
    return 0.15; // 高原植物较少
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
    const seed = chunkRandom * 50 + treeIndex;
    const treeTypeVal = (Math.sin(seed * 234.56) * 43758.5453) % 1;
    const heightRand = (Math.sin(seed * 678.9) * 43758.5453) % 1;
    const absType = Math.abs(treeTypeVal);
    const absHeight = Math.abs(heightRand);

    if (absType < 0.5) {
      const treeHeight = 4 + Math.floor(absHeight * 2);
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
    } else {
      const treeHeight = 5 + Math.floor(absHeight * 3);
      TreeStructureGenerator.growTree(
        writer,
        wx,
        wy,
        wz,
        BLOCK_TYPES.BIRCH_WOOD,
        BLOCK_TYPES.BIRCH_LEAVES,
        treeHeight,
        TreeStyle.BIRCH,
        (wlx, wly, wlz) => noise.pseudoRandom2d(wlx * 17 + wx, wlz * 23 + wz + wly)
      );
    }
  }

  public getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number {
    const r = noise.pseudoRandom2d(wx, wz);
    // 4% 概率生成植被
    if (r < 0.04) {
      if (r < 0.02) {
        return BLOCK_TYPES.DEAD_BUSH;
      } else {
        return BLOCK_TYPES.TALL_GRASS;
      }
    }
    return BLOCK_TYPES.AIR;
  }
}

