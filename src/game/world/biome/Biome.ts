import { ImprovedNoise } from '../Noise';
import type { BlockWriter } from '../TreeStructureGenerator';

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
