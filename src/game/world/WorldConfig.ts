import { BLOCK_TYPES } from './BlockConfig';

export interface OreConfig {
  blockType: number;
  probability: number;
  maxLevel: number;
}

export const WORLD_CONFIG = {
  waterLevel: 150,
  ocean: {
    scale: 0.001,
    threshold: -0.15, // 低于此噪波值为海洋
    transitionWidth: 0.15,
    shoreWidth: 0.05,
    baseHeight: 80,
  },
  river: {
    scale: 0.0025,
    threshold: 0.04,
    transitionWidth: 0.03,
    bedHeight: 142,
  },
  caves: {
    scaleXZ: 0.04,
    scaleY: 0.06,
    threshold: 0.08,
    minHeight: 10,
    maxHeightOffset: 20, // 低于地表几格开始生成矿洞
  },
  biomeScale: 0.003,
  biomeOffset: 2000,
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
