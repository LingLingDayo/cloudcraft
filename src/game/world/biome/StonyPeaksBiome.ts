import { type Biome } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
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
    _isDryLand: boolean,
    _slope: number
  ): void {
    const index = lx + lz * 16 + (y % 16) * 256;
    if (y === 0) {
      chunk[index] = BLOCK_TYPES.STONE; // 基岩
    } else {
      // 表面及地表下方全部直接裸露石头
      chunk[index] = BLOCK_TYPES.STONE;
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
