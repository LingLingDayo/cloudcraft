import { BaseSoilBiome } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class ForestBiome extends BaseSoilBiome {
  public id = 'forest';
  public name = '森林';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.52, targetMoisture = 0.60) {
    super();
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
    this.configuredFeatures = [
      { featureId: 'oak_tree', probability: 0.45 },
      { featureId: 'birch_tree', probability: 0.55 },
    ];
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.25;
  }

  public override getTreeAttempts(chunkRandom: number): number {
    // 森林：5 ~ 9 次尝试
    return 5 + Math.floor(chunkRandom * 12) % 5;
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
