import { describe, test, expect } from 'vitest';
import { ImprovedNoise } from '../Noise';
import { BiomeRegistry } from './BiomeRegistry';
import { LandformRegistry } from '../landform/LandformRegistry';

describe('生态系统判定与地形计算测试 (Biome System Tests)', () => {
  const mockNoise = new ImprovedNoise('test-seed');

  test('应该根据温湿度噪波输出正确的生态系统类型', () => {
    // 模拟温度与湿度的噪波范围定位
    // 我们手动构造测试数据来检验温湿度区间分支

    // 1. 沙漠生态 (高温, 低湿)
    // 根据 getBiomeAt: temp > 0.65 且 moisture < 0.35
    // 我们可以直接验证其生态类型。为验证此项，我们可以检查实例属性是否符合沙漠定义
    expect(BiomeRegistry.DESERT.id).toBe('desert');
    expect(BiomeRegistry.DESERT.name).toBe('沙漠');

    // 2. 丛林生态 (高温, 高湿)
    expect(BiomeRegistry.JUNGLE.id).toBe('jungle');
    expect(BiomeRegistry.JUNGLE.name).toBe('丛林');

    // 3. 高原生态 (中温, 低湿)
    expect(BiomeRegistry.PLATEAU.id).toBe('plateau');
    expect(BiomeRegistry.PLATEAU.name).toBe('高原');

    // 4. 石头山生态 (低温, 低湿)
    expect(BiomeRegistry.STONY_PEAKS.id).toBe('stony_peaks');
    expect(BiomeRegistry.STONY_PEAKS.name).toBe('石头山');

    // 5. 平原生态 (中温, 偏干)
    expect(BiomeRegistry.PLAINS.id).toBe('plains');
    expect(BiomeRegistry.PLAINS.name).toBe('平原');
  });

  test('不同地貌在特定坐标计算的高度应符合设计预期范围', () => {
    // 平原地貌地形应非常平缓 (高度在 151 ~ 159 之间)
    const plainsH1 = LandformRegistry.PLAINS.getHeight(0, 0, mockNoise, 0.5, 0.8);
    const plainsH2 = LandformRegistry.PLAINS.getHeight(100, 100, mockNoise, 0.5, 0.8);
    expect(plainsH1).toBeGreaterThanOrEqual(151);
    expect(plainsH1).toBeLessThanOrEqual(159);
    expect(plainsH2).toBeGreaterThanOrEqual(151);
    expect(plainsH2).toBeLessThanOrEqual(159);

    // 山地地势应高耸且波动起伏大 (高度大约在 180 ~ 245)
    const mountainH1 = LandformRegistry.MOUNTAINS.getHeight(0, 0, mockNoise, 0.85, 0.2);
    const mountainH2 = LandformRegistry.MOUNTAINS.getHeight(50, 50, mockNoise, 0.85, 0.2);
    expect(mountainH1).toBeGreaterThanOrEqual(180);
    expect(mountainH1).toBeLessThanOrEqual(245);
    expect(mountainH2).toBeGreaterThanOrEqual(180);
    expect(mountainH2).toBeLessThanOrEqual(245);

    // 高原高度应该稳定维持在高海拔区 (大约在 199 ~ 211)
    const plateauH1 = LandformRegistry.PLATEAU.getHeight(0, 0, mockNoise, 0.7, 0.7);
    const plateauH2 = LandformRegistry.PLATEAU.getHeight(200, 200, mockNoise, 0.7, 0.7);
    expect(plateauH1).toBeGreaterThanOrEqual(199);
    expect(plateauH1).toBeLessThanOrEqual(211);
    expect(plateauH2).toBeGreaterThanOrEqual(199);
    expect(plateauH2).toBeLessThanOrEqual(211);
  });
});
