import { type Biome, getOreType } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { WORLD_CONFIG } from '../WorldConfig';
import type { BlockWriter } from '../TreeStructureGenerator';

export class StonyPeaksBiome implements Biome {
  public id = 'stony_peaks';
  public name = '石头山';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.1, targetMoisture = 0.15) {
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
  }

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
    noise: ImprovedNoise,
    wx: number,
    wz: number,
    _isDryLand: boolean
  ): void {
    const index = lx + lz * 16 + (y % 16) * 256;
    if (y === 0) {
      chunk[index] = BLOCK_TYPES.STONE; // 基岩
    } else {
      // 表面及地表下方全部直接裸露石头，包含较高矿石生成概率
      chunk[index] = getOreType(y, WORLD_CONFIG.oreGeneration.stonyPeaks, BLOCK_TYPES.STONE, noise, wx, wz);
    }
  }


  public getTreeProbability(_chunkRandom: number): number {
    return 0; // 石头山上不长树
  }

  public growDecorations(
    _writer: BlockWriter,
    _wx: number,
    _wy: number,
    _wz: number,
    _chunkRandom: number,
    _treeIndex: number,
    _noise: ImprovedNoise
  ): void {
    // 空实现，不长树木和其它植物
  }

  public getVegetationType(_wx: number, _wz: number, _noise: ImprovedNoise): number {
    return BLOCK_TYPES.AIR;
  }
}

