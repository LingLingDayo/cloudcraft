import { type Biome, TreeStyle, getOreType } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { WORLD_CONFIG } from '../WorldConfig';
import { TreeStructureGenerator, type BlockWriter } from '../TreeStructureGenerator';

export class ForestBiome implements Biome {
  public id = 'forest';
  public name = '森林';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.52, targetMoisture = 0.60) {
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
  }

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 森林也属于平缓的普通地形，比海平面(150)高出约 1-10 格，但有轻微坡度起伏
    return Math.floor(155 + noise.fbm(wx * 0.015, wz * 0.015, 2, 0.4) * 5);
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
    // 25% 概率在区块内长树，并在区块内长 1~3 棵
    return 0.25;
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
    // 森林内橡树（45%）、白桦（55%）
    // 为了使噪波决定伪随机值，我们基于 wx, wz 和 treeIndex 构造一些伪随机数
    const seed = chunkRandom * 10 + treeIndex;
    const treeTypeVal = (Math.sin(seed * 123.456) * 43758.5453) % 1;
    const heightRand = (Math.sin(seed * 789.012) * 43758.5453) % 1;
    const absType = Math.abs(treeTypeVal);
    const absHeight = Math.abs(heightRand);

    if (absType < 0.45) {
      // Oak tree
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
      // Birch tree
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
    // 14% 概率生成植被
    if (r < 0.14) {
      if (r < 0.098) {
        return BLOCK_TYPES.TALL_GRASS;
      } else if (r < 0.119) {
        // 15% 概率生成单格花朵
        const flowers = [
          BLOCK_TYPES.DANDELION,
          BLOCK_TYPES.POPPY,
          BLOCK_TYPES.BLUE_ORCHID,
          BLOCK_TYPES.ALLIUM,
          BLOCK_TYPES.OXEYE_DAISY
        ];
        const idx = Math.floor((r - 0.098) * 238) % flowers.length;
        return flowers[idx];
      } else {
        // 15% 概率生成双格高植物
        const tallPlants = [
          BLOCK_TYPES.SUNFLOWER_BOTTOM,
          BLOCK_TYPES.ROSE_BUSH_BOTTOM,
          BLOCK_TYPES.PEONY_BOTTOM,
          BLOCK_TYPES.LILAC_BOTTOM,
          BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM
        ];
        const idx = Math.floor((r - 0.119) * 238) % tallPlants.length;
        return tallPlants[idx];
      }
    }
    return BLOCK_TYPES.AIR;
  }
}

