import { ImprovedNoise } from '../Noise';
import type { BlockWriter } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';
import { WORLD_CONFIG } from '../WorldConfig';

export const TreeStyle = {
  OAK: 'oak',
  BIRCH: 'birch',
  SPRUCE: 'spruce',
  JUNGLE: 'jungle',
} as const;

export type TreeStyle = typeof TreeStyle[keyof typeof TreeStyle];

export interface Biome {
  id: string;
  name: string;
  targetTemp: number;       // 生态对应的目标温度点 (用于多噪波参数空间选择)
  targetMoisture: number;   // 生态对应的目标湿度点 (用于多噪波参数空间选择)

  // 根据当前列的各种参数，在此高度 y 填充方块类型，增加了 slope 坡度参数
  fillColumn(
    chunk: Uint8Array,
    lx: number,
    lz: number,
    y: number,
    finalHeight: number,
    waterLevel: number,
    depthBelowSurface: number,
    noise: ImprovedNoise,
    wx: number,
    wz: number,
    isDryLand: boolean,
    slope: number
  ): void;

  // 获取在该生态中长植物/树木的概率
  getTreeProbability(chunkRandom: number): number;

  // 生态专属的装饰物（树木、仙人掌等）生成逻辑，使用统一的 BlockWriter 写入
  growDecorations(
    writer: BlockWriter,
    wx: number,
    wy: number,
    wz: number,
    chunkRandom: number,
    treeIndex: number,
    noise: ImprovedNoise
  ): void;

  // Decide what vegetation (flower/grass) grows at the given coordinates
  getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number;
}

export abstract class BaseSoilBiome implements Biome {
  public abstract id: string;
  public abstract name: string;
  public abstract targetTemp: number;
  public abstract targetMoisture: number;

  protected topBlockType: number = BLOCK_TYPES.GRASS;
  protected underBlockType: number = BLOCK_TYPES.DIRT;

  public fillColumn(
    chunk: Uint8Array,
    lx: number,
    lz: number,
    y: number,
    finalHeight: number,
    waterLevel: number,
    depthBelowSurface: number,
    noise: ImprovedNoise,
    wx: number,
    wz: number,
    _isDryLand: boolean,
    slope: number
  ): void {
    const index = lx + lz * 16 + (y % 16) * 256;
    
    // 计算大陆度以识别是否属于海洋及海岸沙滩带 (c < 0.28)
    const scale = WORLD_CONFIG.landform.scale;
    const c = (noise.noise((wx + WORLD_CONFIG.landform.offsetC) * scale, (wz + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;
    const isOceanOrBeach = c < WORLD_CONFIG.ocean.threshold + WORLD_CONFIG.ocean.shoreWidth;

    if (y === finalHeight) {
      if (slope > 3.0) {
        chunk[index] = BLOCK_TYPES.STONE; // 陡坡裸岩
      } else if (isOceanOrBeach && y <= waterLevel + 2) {
        // 从水底到水上 2 格均填充沙滩，形成自然的沙滩带
        chunk[index] = BLOCK_TYPES.SAND;
      } else {
        chunk[index] = this.topBlockType;
      }
    } else if (depthBelowSurface <= 4) {
      if (slope > 3.0) {
        chunk[index] = BLOCK_TYPES.STONE;
      } else if (isOceanOrBeach && y <= waterLevel + 2) {
        chunk[index] = BLOCK_TYPES.SAND;
      } else {
        chunk[index] = this.underBlockType;
      }
    } else {
      chunk[index] = BLOCK_TYPES.STONE;
    }
  }

  public abstract getTreeProbability(chunkRandom: number): number;
  public abstract growDecorations(
    writer: BlockWriter,
    wx: number,
    wy: number,
    wz: number,
    chunkRandom: number,
    treeIndex: number,
    noise: ImprovedNoise
  ): void;
  public abstract getVegetationType(wx: number, wz: number, noise: ImprovedNoise): number;
}
