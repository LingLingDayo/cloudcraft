import { BaseSoilBiome } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class PlainsBiome extends BaseSoilBiome {
  public id = 'plains';
  public name = '平原';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.55, targetMoisture = 0.40) {
    super();
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
    this.configuredFeatures = [
      { featureId: 'oak_tree', probability: 1.0 }
    ];
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.04;
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
