import { ImprovedNoise } from '../Noise';
import type { Biome } from './Biome';
import { ForestBiome } from './ForestBiome';
import { TaigaBiome } from './TaigaBiome';
import { DesertBiome } from './DesertBiome';
import { JungleBiome } from './JungleBiome';
import { PlateauBiome } from './PlateauBiome';
import { StonyPeaksBiome } from './StonyPeaksBiome';
import { PlainsBiome } from './PlainsBiome';
import { WORLD_CONFIG } from '../WorldConfig';

class BiomeRegistryClass {
  private biomes: Biome[] = [];

  constructor() {
    this.register(new DesertBiome(0.9, 0.1));
    this.register(new JungleBiome(0.8, 0.85));
    this.register(new ForestBiome(0.52, 0.60));
    this.register(new PlainsBiome(0.55, 0.40));
    this.register(new TaigaBiome(0.15, 0.7));
    this.register(new StonyPeaksBiome(0.1, 0.15));
    this.register(new PlateauBiome(0.45, 0.15));
  }

  public register(biome: Biome): void {
    this.biomes.push(biome);
  }

  public getBiomeAt(wx: number, wz: number, noise: ImprovedNoise): Biome {
    // 比例尺设为 WORLD_CONFIG.biomeScale，保证单个生态区域在 300~500 格左右，大小适中
    const scale = WORLD_CONFIG.biomeScale;
    // 偏移以避免温度与湿度出现明显的噪波条纹共振
    const temp = (noise.noise(wx * scale, wz * scale) + 1) / 2;
    const moisture = (noise.noise((wx + WORLD_CONFIG.biomeOffset) * scale, (wz + WORLD_CONFIG.biomeOffset) * scale) + 1) / 2;

    let nearestBiome = this.biomes[0];
    let minDistanceSq = Infinity;

    // 采用多噪波区间匹配：计算当前噪波点 (temp, moisture) 与各群系目标参数 of 距离最近点
    for (const biome of this.biomes) {
      const dt = temp - biome.targetTemp;
      const dm = moisture - biome.targetMoisture;
      const distSq = dt * dt + dm * dm;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        nearestBiome = biome;
      }
    }

    return nearestBiome;
  }

  // 暴露属性以维持同名兼容
  public get FOREST() { return this.biomes.find(b => b.id === 'forest')!; }
  public get TAIGA() { return this.biomes.find(b => b.id === 'taiga')!; }
  public get DESERT() { return this.biomes.find(b => b.id === 'desert')!; }
  public get JUNGLE() { return this.biomes.find(b => b.id === 'jungle')!; }
  public get PLATEAU() { return this.biomes.find(b => b.id === 'plateau')!; }
  public get STONY_PEAKS() { return this.biomes.find(b => b.id === 'stony_peaks')!; }
  public get PLAINS() { return this.biomes.find(b => b.id === 'plains')!; }

  public getBiomes(): readonly Biome[] {
    return this.biomes;
  }
}

export const BiomeRegistry = new BiomeRegistryClass();
export type BiomeType = 'FOREST' | 'TAIGA' | 'DESERT' | 'JUNGLE' | 'PLATEAU' | 'STONY_PEAKS' | 'PLAINS';

export function getBiomeAt(wx: number, wz: number, noise: ImprovedNoise): Biome {
  return BiomeRegistry.getBiomeAt(wx, wz, noise);
}
