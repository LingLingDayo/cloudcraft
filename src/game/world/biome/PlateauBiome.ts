import { BaseSoilBiome } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class PlateauBiome extends BaseSoilBiome {
  public id = 'plateau';
  public name = '高原';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.45, targetMoisture = 0.15) {
    super();
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
    this.configuredFeatures = [
      { featureId: 'oak_tree', probability: 0.5 },
      { featureId: 'birch_tree', probability: 0.5 }
    ];
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.15; // 高原植物较少
  }

  public getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number {
    const r = noise.pseudoRandom2d(wx, wz);
    // 4% 概率生成植被
    if (r < 0.04) {
      return BLOCK_TYPES.TALL_GRASS;
    }
    return BLOCK_TYPES.AIR;
  }
}
