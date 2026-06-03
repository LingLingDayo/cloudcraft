import { ImprovedNoise } from '../Noise';
import type { OreConfig } from '../WorldConfig';

export const TreeStyle = {
  OAK: 'oak',
  BIRCH: 'birch',
  SPRUCE: 'spruce',
  JUNGLE: 'jungle',
} as const;

export type TreeStyle = typeof TreeStyle[keyof typeof TreeStyle];

export type GrowTreeFn = (
  chunk: Uint8Array,
  tx: number,
  ty: number,
  tz: number,
  trunkBlock: number,
  leafBlock: number,
  height: number,
  style: TreeStyle
) => void;

export interface Biome {
  id: string;
  name: string;

  // 根据坐标 (wx, wz) 和噪声计算该生态在该点的地形高度
  getHeight(wx: number, wz: number, noise: ImprovedNoise): number;

  // 根据当前列的各种参数，在此高度 y 填充方块类型
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
    wz: number
  ): void;

  // 获取在该生态中长植物/树木的概率
  getTreeProbability(chunkRandom: number): number;

  // 生态专属的装饰物（树木、仙人掌等）生成逻辑
  growDecorations(
    chunk: Uint8Array,
    tx: number,
    ty: number,
    tz: number,
    chunkRandom: number,
    treeIndex: number,
    growTree: GrowTreeFn
  ): void;
}

export function getOreType(y: number, ores: readonly OreConfig[], defaultBlock: number): number {
  const r = Math.random();
  for (const ore of ores) {
    if (r < ore.probability && y < ore.maxLevel) {
      return ore.blockType;
    }
  }
  return defaultBlock;
}
