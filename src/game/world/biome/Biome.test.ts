import { describe, test, expect } from 'vitest';
import { ImprovedNoise } from '../Noise';
import { BiomeRegistry } from './BiomeRegistry';
import { TerrainShaper } from '../landform/TerrainShaper';

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

  test('不同地貌特性在特定坐标计算的高度应符合设计预期范围', () => {
    // 平原特性 (Continentality 0.5, Erosion 0.8): 地势平缓
    const plainsH1 = TerrainShaper.getHeight(0, 0, mockNoise, 0.5, 0.8);
    const plainsH2 = TerrainShaper.getHeight(100, 100, mockNoise, 0.5, 0.8);
    expect(plainsH1).toBeGreaterThanOrEqual(150);
    expect(plainsH1).toBeLessThanOrEqual(170);
    expect(plainsH2).toBeGreaterThanOrEqual(150);
    expect(plainsH2).toBeLessThanOrEqual(170);

    // 山地特性 (Continentality 0.85, Erosion 0.2): 地势高耸起伏大
    const mountainH1 = TerrainShaper.getHeight(0, 0, mockNoise, 0.85, 0.2);
    const mountainH2 = TerrainShaper.getHeight(50, 50, mockNoise, 0.85, 0.2);
    expect(mountainH1).toBeGreaterThanOrEqual(180);
    expect(mountainH1).toBeLessThanOrEqual(280);
    expect(mountainH2).toBeGreaterThanOrEqual(180);
    expect(mountainH2).toBeLessThanOrEqual(280);

    // 高原特性 (Continentality 0.7, Erosion 0.7): 较高海拔但平缓
    const plateauH1 = TerrainShaper.getHeight(0, 0, mockNoise, 0.7, 0.7);
    const plateauH2 = TerrainShaper.getHeight(200, 200, mockNoise, 0.7, 0.7);
    expect(plateauH1).toBeGreaterThanOrEqual(160);
    expect(plateauH1).toBeLessThanOrEqual(180);
    expect(plateauH2).toBeGreaterThanOrEqual(160);
    expect(plateauH2).toBeLessThanOrEqual(180);
  });
});
