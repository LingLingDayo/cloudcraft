import { BaseSoilBiome } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class JungleBiome extends BaseSoilBiome {
  public id = 'jungle';
  public name = '丛林';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.8, targetMoisture = 0.85) {
    super();
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
    this.configuredFeatures = [
      { featureId: 'jungle_tree', probability: 1.0 }
    ];
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.4; // 繁茂的丛林，树木极多
  }

  public override getTreeAttempts(chunkRandom: number): number {
    // 丛林更密：8 ~ 14 次尝试
    return 8 + Math.floor(chunkRandom * 24) % 7;
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
