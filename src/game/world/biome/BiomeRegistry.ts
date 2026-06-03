import { ImprovedNoise } from '../Noise';
import type { Biome } from './Biome';
import { ForestBiome } from './ForestBiome';
import { TaigaBiome } from './TaigaBiome';
import { DesertBiome } from './DesertBiome';
import { JungleBiome } from './JungleBiome';
import { PlateauBiome } from './PlateauBiome';
import { StonyPeaksBiome } from './StonyPeaksBiome';
import { WORLD_CONFIG } from '../WorldConfig';

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
  // 比例尺设为 WORLD_CONFIG.biomeScale，保证单个生态区域在 300~500 格左右，大小适中
  const scale = WORLD_CONFIG.biomeScale;
  // 偏移以避免温度与湿度出现明显的噪波条纹共振
  const temp = (noise.noise(wx * scale, wz * scale) + 1) / 2;
  const moisture = (noise.noise((wx + WORLD_CONFIG.biomeOffset) * scale, (wz + WORLD_CONFIG.biomeOffset) * scale) + 1) / 2;

  if (temp > WORLD_CONFIG.biomeTempThresholds.hot) {
    if (moisture < WORLD_CONFIG.biomeMoistureThresholds.dry) return BiomeRegistry.DESERT;
    if (moisture > WORLD_CONFIG.biomeMoistureThresholds.wet) return BiomeRegistry.JUNGLE;
    return BiomeRegistry.FOREST;
  } else if (temp < WORLD_CONFIG.biomeTempThresholds.cold) {
    if (moisture < WORLD_CONFIG.biomeMoistureThresholds.dry) return BiomeRegistry.STONY_PEAKS;
    return BiomeRegistry.TAIGA;
  } else {
    if (moisture < WORLD_CONFIG.biomeMoistureThresholds.dry) return BiomeRegistry.PLATEAU;
    return BiomeRegistry.FOREST;
  }
}
