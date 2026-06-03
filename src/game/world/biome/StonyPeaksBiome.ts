import { type Biome, getOreType } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { WORLD_CONFIG } from '../WorldConfig';

export class StonyPeaksBiome implements Biome {
  public id = 'stony_peaks';
  public name = '石头山';

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 高耸起伏大，使用脊线噪波 (1 - abs(noise)) 模拟尖锐山脊
    const base = 200;
    const n = noise.fbm(wx * 0.015, wz * 0.015, 3, 0.4);
    const ridged = 1.0 - Math.abs(n);
    return Math.floor(base + ridged * 80);
  }

  public fillColumn(
    chunk: Uint8Array,
    lx: number,
    lz: number,
    y: number,
    _finalHeight: number,
    _waterLevel: number,
    _depthBelowSurface: number,
    _noise: ImprovedNoise,
    _wx: number,
    _wz: number,
    _isDryLand: boolean
  ): void {
    const index = lx + lz * 16 + y * 256;
    if (y === 0) {
      chunk[index] = BLOCK_TYPES.STONE; // 基岩
    } else {
      // 表面及地表下方全部直接裸露石头，包含较高矿石生成概率
      chunk[index] = getOreType(y, WORLD_CONFIG.oreGeneration.stonyPeaks, BLOCK_TYPES.STONE);
    }
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0; // 石头山上不长树
  }

  public growDecorations(): void {
    // 空实现，不长树木和其它植物
  }
}
