import { BaseSoilBiome, TreeStyle } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { TreeStructureGenerator, type BlockWriter } from '../TreeStructureGenerator';

export class ForestBiome extends BaseSoilBiome {
  public id = 'forest';
  public name = '森林';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.52, targetMoisture = 0.60) {
    super();
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
  }

  public getTreeProbability(_chunkRandom: number): number {
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
    if (r < 0.14) {
      if (r < 0.098) {
        return BLOCK_TYPES.TALL_GRASS;
      } else if (r < 0.119) {
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
