import { type Biome } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import type { BlockWriter } from '../TreeStructureGenerator';

export class DesertBiome implements Biome {
  public id = 'desert';
  public name = '沙漠';
  public targetTemp: number;
  public targetMoisture: number;

  constructor(targetTemp = 0.9, targetMoisture = 0.1) {
    this.targetTemp = targetTemp;
    this.targetMoisture = targetMoisture;
  }

  public fillColumn(
    chunk: Uint8Array,
    lx: number,
    lz: number,
    y: number,
    finalHeight: number,
    _waterLevel: number,
    depthBelowSurface: number,
    _noise: ImprovedNoise,
    _wx: number,
    _wz: number,
    _isDryLand: boolean,
    slope: number
  ): void {
    const index = lx + lz * 16 + (y % 16) * 256;
    if (y === 0) {
      chunk[index] = BLOCK_TYPES.STONE; // 基岩
    } else if (y <= finalHeight) {
      if (slope > 3.5) {
        // 陡坡上砂石裸露
        if (depthBelowSurface <= 4) {
          chunk[index] = BLOCK_TYPES.SANDSTONE;
        } else {
          chunk[index] = BLOCK_TYPES.STONE;
        }
      } else {
        if (depthBelowSurface <= 4) {
          chunk[index] = BLOCK_TYPES.SAND; // 地表沙子
        } else if (depthBelowSurface <= 8) {
          chunk[index] = BLOCK_TYPES.SANDSTONE; // 深层砂岩
        } else {
          chunk[index] = BLOCK_TYPES.STONE;
        }
      }
    }
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.12; // 较低的植物生存率
  }

  public growDecorations(
    writer: BlockWriter,
    wx: number,
    wy: number,
    wz: number,
    chunkRandom: number,
    treeIndex: number,
    _noise: ImprovedNoise
  ): void {
    // 在地表长出 1~3 层高的仙人掌
    const seed = chunkRandom * 30 + treeIndex;
    const heightRand = (Math.sin(seed * 321.09) * 43758.5453) % 1;
    const absHeight = Math.abs(heightRand);
    const cactusHeight = 1 + Math.floor(absHeight * 3);

    for (let h = 1; h <= cactusHeight; h++) {
      const cy = wy + h;
      if (cy < 512) { // WORLD_HEIGHT is 512
        if (writer.getBlock(wx, cy, wz) === BLOCK_TYPES.AIR) {
          writer.setBlock(wx, cy, wz, BLOCK_TYPES.CACTUS);
        }
      }
    }
  }

  public getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number {
    const r = noise.pseudoRandom2d(wx, wz);
    // 3% 概率生成枯萎灌木
    if (r < 0.03) {
      return BLOCK_TYPES.DEAD_BUSH;
    }
    return BLOCK_TYPES.AIR;
  }
}
