import type { Biome } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';

export class StonyPeaksBiome implements Biome {
  public id = 'stony_peaks';
  public name = '石头山';

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 高耸起伏大，使用脊线噪波 (1 - abs(noise)) 模拟尖锐山脊
    const base = 32;
    const n = noise.fbm(wx * 0.015, wz * 0.015, 3, 0.4);
    const ridged = 1.0 - Math.abs(n);
    return Math.floor(base + ridged * 24);
  }

  public fillColumn(
    chunk: Uint8Array,
    lx: number,
    lz: number,
    y: number,
    _finalHeight: number
  ): void {
    const index = lx + lz * 16 + y * 256;
    if (y === 0) {
      chunk[index] = BLOCK_TYPES.STONE; // 基岩
    } else {
      // 表面及地表下方全部直接裸露石头，包含较高矿石生成概率
      const r = Math.random();
      if (r < 0.012 && y < 20) {
        chunk[index] = BLOCK_TYPES.DIAMOND;
      } else if (r < 0.03 && y < 45) {
        chunk[index] = BLOCK_TYPES.IRON;
      } else if (r < 0.06 && y < 55) {
        chunk[index] = BLOCK_TYPES.COAL;
      } else {
        chunk[index] = BLOCK_TYPES.STONE;
      }
    }
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0; // 石头山上不长树
  }

  public growDecorations(): void {
    // 空实现，不长树木和其它植物
  }
}
