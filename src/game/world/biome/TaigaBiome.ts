import { BaseSoilBiome } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class TaigaBiome extends BaseSoilBiome {
  public id = 'taiga';
  public name = '针叶林';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.15, targetMoisture = 0.7) {
    super();
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
    this.configuredFeatures = [
      { featureId: 'spruce_tree', probability: 1.0 }
    ];
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.3; // 针叶林树木稍微密集一些
  }

  public override getTreeAttempts(chunkRandom: number): number {
    // 针叶林：4 ~ 7 次尝试
    return 4 + Math.floor(chunkRandom * 12) % 4;
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
