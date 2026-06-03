import { ImprovedNoise } from '../Noise';
import type { Biome } from './Biome';
import { ForestBiome } from './ForestBiome';
import { TaigaBiome } from './TaigaBiome';
import { DesertBiome } from './DesertBiome';
import { JungleBiome } from './JungleBiome';
import { PlateauBiome } from './PlateauBiome';
import { StonyPeaksBiome } from './StonyPeaksBiome';

export const BiomeRegistry = {
  FOREST: new ForestBiome(),
  TAIGA: new TaigaBiome(),
  DESERT: new DesertBiome(),
  JUNGLE: new JungleBiome(),
  PLATEAU: new PlateauBiome(),
  STONY_PEAKS: new StonyPeaksBiome(),
} as const;

export type BiomeType = keyof typeof BiomeRegistry;

export function getBiomeAt(wx: number, wz: number, noise: ImprovedNoise): Biome {
  // 比例尺设为 0.003，保证单个生态区域在 300~500 格左右，大小适中
  const scale = 0.003;
  // 偏移以避免温度与湿度出现明显的噪波条纹共振
  const temp = (noise.noise(wx * scale, wz * scale) + 1) / 2;
  const moisture = (noise.noise((wx + 2000) * scale, (wz + 2000) * scale) + 1) / 2;

  if (temp > 0.65) {
    if (moisture < 0.35) return BiomeRegistry.DESERT;
    if (moisture > 0.65) return BiomeRegistry.JUNGLE;
    return BiomeRegistry.FOREST;
  } else if (temp < 0.35) {
    if (moisture < 0.35) return BiomeRegistry.STONY_PEAKS;
    return BiomeRegistry.TAIGA;
  } else {
    if (moisture < 0.35) return BiomeRegistry.PLATEAU;
    return BiomeRegistry.FOREST;
  }
}
