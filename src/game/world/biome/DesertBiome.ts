import { type Biome, getOreType } from './Biome';
import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { WORLD_CONFIG } from '../WorldConfig';
import { CHUNK_SIZE_Y } from '../World';

export class DesertBiome implements Biome {
  public id = 'desert';
  public name = '沙漠';

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 极其平缓，有微弱的沙丘起伏
    return Math.floor(160 + noise.noise(wx * 0.05, wz * 0.05) * 4);
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
    _isDryLand: boolean
  ): void {
    const index = lx + lz * 16 + y * 256;
    if (y === 0) {
      chunk[index] = BLOCK_TYPES.STONE; // 基岩
    } else if (y <= finalHeight) {
      if (depthBelowSurface <= 4) {
        chunk[index] = BLOCK_TYPES.SAND; // 地表沙子
      } else if (depthBelowSurface <= 8) {
        chunk[index] = BLOCK_TYPES.SANDSTONE; // 深层砂岩
      } else {
        // 最深层是石头加矿石
        chunk[index] = getOreType(y, WORLD_CONFIG.oreGeneration.default, BLOCK_TYPES.STONE);
      }
    }
  }

  public getTreeProbability(_chunkRandom: number): number {
    return 0.12; // 较低的植物生存率
  }

  public growDecorations(
    chunk: Uint8Array,
    tx: number,
    ty: number,
    tz: number,
    chunkRandom: number,
    treeIndex: number
  ): void {
    // 在地表长出 1~3 层高的仙人掌
    const seed = chunkRandom * 30 + treeIndex;
    const heightRand = (Math.sin(seed * 321.09) * 43758.5453) % 1;
    const absHeight = Math.abs(heightRand);
    const cactusHeight = 1 + Math.floor(absHeight * 3);

    for (let h = 1; h <= cactusHeight; h++) {
      const cy = ty + h;
      if (cy < CHUNK_SIZE_Y) {
        const idx = tx + tz * 16 + cy * 256;
        if (chunk[idx] === BLOCK_TYPES.AIR) {
          chunk[idx] = BLOCK_TYPES.CACTUS;
        }
      }
    }
  }
}
