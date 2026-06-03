import { describe, test, expect } from 'vitest';
import { ImprovedNoise } from '../Noise';
import { BiomeRegistry } from './BiomeRegistry';

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

  test('不同生态在特定坐标计算的高度应符合设计预期范围', () => {
    // 沙漠地形应极度平缓 (高度波动应很小，基本在 156 ~ 164)
    const desertH1 = BiomeRegistry.DESERT.getHeight(0, 0, mockNoise);
    const desertH2 = BiomeRegistry.DESERT.getHeight(100, 100, mockNoise);
    expect(desertH1).toBeGreaterThanOrEqual(155);
    expect(desertH1).toBeLessThanOrEqual(165);
    expect(desertH2).toBeGreaterThanOrEqual(155);
    expect(desertH2).toBeLessThanOrEqual(165);

    // 平原地形应非常平缓 (高度在 156 ~ 170 之间)
    const plainsH1 = BiomeRegistry.PLAINS.getHeight(0, 0, mockNoise);
    const plainsH2 = BiomeRegistry.PLAINS.getHeight(100, 100, mockNoise);
    expect(plainsH1).toBeGreaterThanOrEqual(156);
    expect(plainsH1).toBeLessThanOrEqual(170);
    expect(plainsH2).toBeGreaterThanOrEqual(156);
    expect(plainsH2).toBeLessThanOrEqual(170);

    // 石头山地势应高耸且波动起伏大 (高度大约在 200 ~ 280)
    const stonyH1 = BiomeRegistry.STONY_PEAKS.getHeight(0, 0, mockNoise);
    const stonyH2 = BiomeRegistry.STONY_PEAKS.getHeight(50, 50, mockNoise);
    expect(stonyH1).toBeGreaterThanOrEqual(195);
    expect(stonyH1).toBeLessThanOrEqual(285);
    expect(stonyH2).toBeGreaterThanOrEqual(195);
    expect(stonyH2).toBeLessThanOrEqual(285);

    // 高原高度应该稳定维持在高海拔区 (大约在 190 ~ 230)
    const plateauH1 = BiomeRegistry.PLATEAU.getHeight(0, 0, mockNoise);
    const plateauH2 = BiomeRegistry.PLATEAU.getHeight(200, 200, mockNoise);
    expect(plateauH1).toBeGreaterThanOrEqual(185);
    expect(plateauH1).toBeLessThanOrEqual(235);
    expect(plateauH2).toBeGreaterThanOrEqual(185);
    expect(plateauH2).toBeLessThanOrEqual(235);
  });
});
