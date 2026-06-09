import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import { OakTreeFeature } from './OakTreeFeature';
import { BirchTreeFeature } from './BirchTreeFeature';
import { SpruceTreeFeature } from './SpruceTreeFeature';
import { JungleTreeFeature } from './JungleTreeFeature';
import { CactusFeature } from './CactusFeature';

/**
 * 统一的地表/世界特征生成接口
 */
export interface WorldFeature {
  readonly id: string;

  /**
   * 在世界指定坐标生成该特征
   * @param writer 方块修改器适配器
   * @param x 世界绝对坐标 X
   * @param y 世界绝对坐标 Y
   * @param z 世界绝对坐标 Z
   * @param random 伪随机数提供者，用以确保跨区块生成的一致性
   * @returns 是否成功生成
   */
  generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean;
}

/**
 * 全局特征注册中心，管理所有 WorldFeature 实例
 */
export class FeatureRegistry {
  private static features = new Map<string, WorldFeature>();
  private static initialized = false;

  /**
   * 初始化注册中心并注册默认特征
   */
  public static init(): void {
    if (this.initialized) return;
    this.register(new OakTreeFeature());
    this.register(new BirchTreeFeature());
    this.register(new SpruceTreeFeature());
    this.register(new JungleTreeFeature());
    this.register(new CactusFeature());
    this.initialized = true;
  }

  /**
   * 注册特征
   */
  public static register(feature: WorldFeature): void {
    this.features.set(feature.id, feature);
  }

  /**
   * 获取特征
   */
  public static get(id: string): WorldFeature | undefined {
    this.init();
    return this.features.get(id);
  }

  /**
   * 清除特征（供测试或重新初始化使用）
   */
  public static clear(): void {
    this.features.clear();
    this.initialized = false;
  }
}

/**
 * 配置化特征载体，描述某特征在特定生态中的概率与特有配置
 */
export interface ConfiguredFeature {
  featureId: string;
  probability: number;
  config?: unknown;
}
