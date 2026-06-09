import { describe, test, expect } from 'vitest';
import { FeatureRegistry } from './WorldFeature';
import { OakTreeFeature } from './OakTreeFeature';
import { CactusFeature } from './CactusFeature';
import { MemoryBlockWriter } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';

describe('世界地表特征生成系统测试 (WorldFeature & Registry Tests)', () => {
  test('FeatureRegistry 应该自动初始化并管理默认特征', () => {
    // 触发初始化
    FeatureRegistry.init();

    const oak = FeatureRegistry.get('oak_tree');
    const birch = FeatureRegistry.get('birch_tree');
    const spruce = FeatureRegistry.get('spruce_tree');
    const jungle = FeatureRegistry.get('jungle_tree');
    const cactus = FeatureRegistry.get('cactus');

    expect(oak).toBeDefined();
    expect(birch).toBeDefined();
    expect(spruce).toBeDefined();
    expect(jungle).toBeDefined();
    expect(cactus).toBeDefined();
    expect(oak?.id).toBe('oak_tree');
  });

  test('OakTreeFeature 应该正确生成橡树结构并在地表铺设泥土', () => {
    const oakFeature = new OakTreeFeature();
    const writer = new MemoryBlockWriter();
    const mockRandom = () => 0.1; // 固定高度的随机数

    // 执行橡树生成
    // 根部坐标设在 (0, 10, 0)
    oakFeature.generate(writer, 0, 10, 0, mockRandom);

    // 基底 y=10 应该被修改为 DIRT
    expect(writer.getBlock(0, 10, 0)).toBe(BLOCK_TYPES.DIRT);

    // 树干 y=11..14 (高度 4格) 应该为 WOOD
    expect(writer.getBlock(0, 11, 0)).toBe(BLOCK_TYPES.WOOD);
    expect(writer.getBlock(0, 12, 0)).toBe(BLOCK_TYPES.WOOD);
    expect(writer.getBlock(0, 13, 0)).toBe(BLOCK_TYPES.WOOD);
    expect(writer.getBlock(0, 14, 0)).toBe(BLOCK_TYPES.WOOD);

    // 树冠叶子应该在上方生成
    expect(writer.getBlock(0, 15, 0)).toBe(BLOCK_TYPES.AIR); // 树干直上
    expect(writer.getBlock(1, 15, 1)).toBe(BLOCK_TYPES.LEAF); // 旁侧叶子
  });

  test('CactusFeature 应该在沙漠生成仙人掌且不破坏沙子基底', () => {
    const cactusFeature = new CactusFeature();
    const writer = new MemoryBlockWriter();
    const mockRandom = () => 0.5; // 生成 2 格高的仙人掌

    // 假设基底方块为 SAND
    writer.setBlock(0, 10, 0, BLOCK_TYPES.SAND);

    // 生长仙人掌
    cactusFeature.generate(writer, 0, 10, 0, mockRandom);

    // 基底 y=10 依然保持为 SAND 状态，不可改为 DIRT
    expect(writer.getBlock(0, 10, 0)).toBe(BLOCK_TYPES.SAND);

    // 上方 y=11..12 应该为 CACTUS
    expect(writer.getBlock(0, 11, 0)).toBe(BLOCK_TYPES.CACTUS);
    expect(writer.getBlock(0, 12, 0)).toBe(BLOCK_TYPES.CACTUS);
    expect(writer.getBlock(0, 13, 0)).toBe(BLOCK_TYPES.AIR);
  });
});
