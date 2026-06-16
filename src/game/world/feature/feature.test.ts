import { describe, test, expect } from 'vitest';
import { FeatureRegistry } from './WorldFeature';
import { OakTreeFeature } from './OakTreeFeature';
import { CactusFeature } from './CactusFeature';
import { MemoryBlockWriter } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';
import {
  GenericTreeFeature,
  StraightTrunkPlacer,
  BlobFoliagePlacer,
} from './GenericTreeFeature';


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

describe('策略组合与开闭原则验证 (Placers & OCP Verification)', () => {
  test('StraightTrunkPlacer 应该正确生成指定长度的树干并返回其坐标', () => {
    const placer = new StraightTrunkPlacer();
    const writer = new MemoryBlockWriter();
    const positions = placer.place(writer, 0, 10, 0, 5, BLOCK_TYPES.WOOD, () => 0.5);

    expect(positions.length).toBe(5);
    expect(positions[0]).toEqual({ x: 0, y: 11, z: 0 });
    expect(positions[4]).toEqual({ x: 0, y: 15, z: 0 });
    expect(writer.getBlock(0, 11, 0)).toBe(BLOCK_TYPES.WOOD);
    expect(writer.getBlock(0, 15, 0)).toBe(BLOCK_TYPES.WOOD);
  });

  test('BlobFoliagePlacer 应该支持自定义半径和角落剔除配置', () => {
    const placer = new BlobFoliagePlacer({
      minLy: -1,
      maxLy: 1,
      radiusProvider: (ly) => (ly === 1 ? 1 : 2),
      excludeCornersLayers: [-1], // 在 ly = -1 剔除角落
      discardChance: 0 // 不进行概率丢弃
    });
    const writer = new MemoryBlockWriter();
    // 假设树高 5，主干顶部在 (0, 15, 0)
    placer.place(
      writer,
      0, 10, 0,
      5,
      BLOCK_TYPES.LEAF,
      [{ x: 0, y: 11, z: 0 }, { x: 0, y: 12, z: 0 }, { x: 0, y: 13, z: 0 }, { x: 0, y: 14, z: 0 }, { x: 0, y: 15, z: 0 }],
      () => 0.5
    );

    // ly = 1 的半径是 1，应该有叶子
    expect(writer.getBlock(1, 17, 0)).toBe(BLOCK_TYPES.LEAF); // y = 10 + 5 + 1 + 1 = 17
    
    // ly = -1 的半径是 2，且 excludeCornersLayers 包括 -1，所以 y = 15 的角落 (2, 15, 2) 应该没有叶子
    expect(writer.getBlock(2, 15, 2)).toBe(BLOCK_TYPES.AIR); // 角落剔除
    expect(writer.getBlock(2, 15, 0)).toBe(BLOCK_TYPES.LEAF); // 边缘非角落应该有叶子
  });

  test('可通过 GenericTreeFeature 轻松组装出自定义特征树 (开闭原则验证)', () => {
    // 假设我们要定义一种“秋季枫树”，它使用 WOOD 树干，但是使用 CACTUS 做假的红叶 (测试而已)
    const mapleTree = new GenericTreeFeature('maple_tree', {
      trunkBlock: BLOCK_TYPES.WOOD,
      leafBlock: BLOCK_TYPES.CACTUS, // 临时选用 CACTUS 充当测试叶子
      minHeight: 3,
      heightVariance: 1,
      trunkPlacer: new StraightTrunkPlacer(),
      foliagePlacer: new BlobFoliagePlacer({
        minLy: -1,
        maxLy: 1,
        radiusProvider: () => 1,
        discardChance: 0
      })
    });

    const writer = new MemoryBlockWriter();
    mapleTree.generate(writer, 0, 10, 0, () => 0); // 树高将是固定 3

    expect(writer.getBlock(0, 10, 0)).toBe(BLOCK_TYPES.DIRT); // 基础变成泥土
    expect(writer.getBlock(0, 11, 0)).toBe(BLOCK_TYPES.WOOD); // 树干 y=11
    expect(writer.getBlock(0, 12, 0)).toBe(BLOCK_TYPES.WOOD); // 树干 y=12
    expect(writer.getBlock(0, 13, 0)).toBe(BLOCK_TYPES.WOOD); // 树干 y=13
    
    // 树冠中心 ly = 0, 1, -1
    // y = 10 + 3 + 1 = 14 (leafCenterY)
    // ly = -1 对应 y = 13 (有树干，不覆盖)
    // ly = 1 对应 y = 15 (半径 1)
    expect(writer.getBlock(1, 15, 0)).toBe(BLOCK_TYPES.CACTUS); // 充当叶子的 CACTUS
  });

  test('JungleTreeFeature 应该能多态生成普通丛林树与巨型 2x2 丛林树', () => {
    const jungleFeature = FeatureRegistry.get('jungle_tree');
    expect(jungleFeature).toBeDefined();

    // 1. 当随机数绝对值 >= 0.25 (如 0.5) 时，生成普通 1x1 丛林树
    const smallWriter = new MemoryBlockWriter();
    const mockRandomSmall = (rx: number, ry: number, rz: number) => {
      if (rx === 0 && ry === 10 && rz === 0) return 0.5; // typeRand
      if (rx === 1 && ry === 10 && rz === 1) return 0;   // heightRand (高度 = 7)
      return 0.5; 
    };

    jungleFeature!.generate(smallWriter, 0, 10, 0, mockRandomSmall);
    expect(smallWriter.getBlock(0, 10, 0)).toBe(BLOCK_TYPES.DIRT);
    expect(smallWriter.getBlock(0, 11, 0)).toBe(BLOCK_TYPES.JUNGLE_WOOD);
    expect(smallWriter.getBlock(0, 17, 0)).toBe(BLOCK_TYPES.JUNGLE_WOOD);
    expect(smallWriter.getBlock(0, 18, 0)).toBe(BLOCK_TYPES.AIR);

    // 2. 当随机数绝对值 < 0.25 (如 0.1) 时，生成 2x2 巨型丛林树
    const megaWriter = new MemoryBlockWriter();
    const mockRandomMega = (rx: number, ry: number, rz: number) => {
      if (rx === 0 && ry === 10 && rz === 0) return 0.1; // typeRand (巨型大树)
      if (rx === 1 && ry === 10 && rz === 1) return 0;   // heightRand (高度 = 16)
      return 0.9; // 其他随机数，不生成随机大侧枝
    };

    jungleFeature!.generate(megaWriter, 0, 10, 0, mockRandomMega);

    // 2x2 地基都变成泥土
    expect(megaWriter.getBlock(0, 10, 0)).toBe(BLOCK_TYPES.DIRT);
    expect(megaWriter.getBlock(1, 10, 0)).toBe(BLOCK_TYPES.DIRT);
    expect(megaWriter.getBlock(0, 10, 1)).toBe(BLOCK_TYPES.DIRT);
    expect(megaWriter.getBlock(1, 10, 1)).toBe(BLOCK_TYPES.DIRT);

    // 2x2 树干 16格高 (y=11..26)
    expect(megaWriter.getBlock(0, 11, 0)).toBe(BLOCK_TYPES.JUNGLE_WOOD);
    expect(megaWriter.getBlock(1, 11, 0)).toBe(BLOCK_TYPES.JUNGLE_WOOD);
    expect(megaWriter.getBlock(0, 26, 1)).toBe(BLOCK_TYPES.JUNGLE_WOOD);
    expect(megaWriter.getBlock(1, 26, 1)).toBe(BLOCK_TYPES.JUNGLE_WOOD);

    expect(megaWriter.getBlock(0, 27, 0)).toBe(BLOCK_TYPES.AIR);
  });
});


