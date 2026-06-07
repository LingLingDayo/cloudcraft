import { BLOCK_TYPES } from './BlockConfig';

export interface OreConfig {
  blockType: number;
  probability: number;
  maxLevel: number;
}

export const WORLD_CONFIG = {
  waterLevel: 150,
  ocean: {
    threshold: 0.23, // 大陆度低于此阈值为海洋
    transitionWidth: 0.10,
    shoreWidth: 0.05,
    baseHeight: 80,
    shallowRatio: 0.25, // 大陆度过渡百分比：0~25% 为浅海滩区
    shallowDepth: 4,     // 浅海滩区的最大深度 (低于海平面 4 格)
    variance: 15,        // 海洋海床的多维噪波起伏半振幅
  },
  river: {
    scale: 0.0025,
    threshold: 0.04,
    transitionWidth: 0.03,
    bedHeight: 142,
    valleyInfluenceWidth: 0.10, // 新增：河谷扁平化过渡宽度
    valleyTargetHeight: 153,    // 新增：目标河谷地表高度，比海平面高 3 格
    bankOffsets: {
      mountains: 6.0,
      plateau: 4.5,
      hills: 3.5,
      plains: 1.5,
      default: 2.0,
    } as const,
  },
  pond: {
    probability: 0.03, // 3% of cells have a pond
    gridSize: 32,
    minRadius: 4,
    maxRadius: 18,
  },
  caves: {
    scaleXZ: 0.04,
    scaleY: 0.06,
    threshold: 0.08,
    minHeight: 10,
    maxHeightOffset: 20, // 低于地表几格开始生成矿洞
    baseThreshold: 0.12, // 矿洞基础阈值
    maxHeightOffsetDefault: 12, // 默认限制高度
    maxHeightOffsetEntrance: -3, // 露天入口限制高度
    warpScale: 0.05, // 坐标扭曲噪波频率
    warpStrength: 5.0, // 坐标扭曲偏移强度
  },
  biomeScale: 0.003,
  biomeOffset: 2000,
  landform: {
    scale: 0.003,
    offsetC: 4000,
    offsetE: 6000,
  },
  biomeTempThresholds: {
    hot: 0.65,
    cold: 0.35,
  },
  biomeMoistureThresholds: {
    wet: 0.65,
    dry: 0.35,
  },
  heightInterpolation: {
    step: 4,
    sigmaSq: 32,
  },
  oreGeneration: {
    default: [
      { blockType: BLOCK_TYPES.DIAMOND, probability: 0.01, maxLevel: 120 },
      { blockType: BLOCK_TYPES.IRON, probability: 0.02, maxLevel: 240 },
      { blockType: BLOCK_TYPES.COAL, probability: 0.04, maxLevel: 350 },
    ] as const,
    stonyPeaks: [
      { blockType: BLOCK_TYPES.DIAMOND, probability: 0.012, maxLevel: 150 },
      { blockType: BLOCK_TYPES.IRON, probability: 0.03, maxLevel: 350 },
      { blockType: BLOCK_TYPES.COAL, probability: 0.06, maxLevel: 420 },
    ] as const,
  },
} as const;

export const TEST_SEED_IDENTIFIER = 'test';

export function isTestSeed(seed: string): boolean {
  const lower = seed.toLowerCase();
  return lower.includes(TEST_SEED_IDENTIFIER) || lower.endsWith('-seed');
}
