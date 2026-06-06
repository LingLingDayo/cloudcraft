import { ImprovedNoise } from '../Noise';
import { BLOCK_TYPES } from '../BlockConfig';
import { type OreGenerator, PointOreGenerator, VeinOreGenerator } from './OreGenerator';

export class OreRegistry {
  private static generators: OreGenerator[] = [];
  private static initialized = false;

  public static register(generator: OreGenerator): void {
    this.generators.push(generator);
    // 优先级从高到低排序，高优先级生成器先进行尝试
    this.generators.sort((a, b) => b.priority - a.priority);
  }

  public static getGenerators(): readonly OreGenerator[] {
    this.ensureInitialized();
    return this.generators;
  }

  /**
   * 清除所有已注册的生成器（主要用于单元测试）。
   */
  public static clear(): void {
    this.generators = [];
    this.initialized = false;
  }

  /**
   * 初始化默认的矿石生成器。
   */
  public static initDefaults(): void {
    if (this.initialized) return;
    this.generators = [];

    // ─── 1. 经典的点状矿石生成器 (Point Ores) ───
    
    // 石头山群系专属的高概率矿石分布
    this.register(new PointOreGenerator('stony_peaks_coal', BLOCK_TYPES.COAL, 0.06, 420, 0, ['stony_peaks']));
    this.register(new PointOreGenerator('stony_peaks_iron', BLOCK_TYPES.IRON, 0.03, 350, 0, ['stony_peaks']));
    this.register(new PointOreGenerator('stony_peaks_diamond', BLOCK_TYPES.DIAMOND, 0.012, 150, 0, ['stony_peaks']));

    // 普通群系默认矿石分布 (排除 stony_peaks)
    const commonBiomes = ['forest', 'desert', 'jungle', 'plains', 'plateau', 'taiga'];
    this.register(new PointOreGenerator('default_coal', BLOCK_TYPES.COAL, 0.04, 350, 0, commonBiomes));
    this.register(new PointOreGenerator('default_iron', BLOCK_TYPES.IRON, 0.02, 240, 0, commonBiomes));
    this.register(new PointOreGenerator('default_diamond', BLOCK_TYPES.DIAMOND, 0.01, 120, 0, commonBiomes));

    // ─── 2. 战略级扩展：新型连续矿脉生成器 (Vein Ores) ───
    // 优先级为 10，能先于普通点状矿石判定，并在地下深处画出如蛛网蔓延的矿脉
    
    // 连续煤矿脉 (全局高度 260 以下)
    this.register(
      new VeinOreGenerator(
        'vein_coal',
        BLOCK_TYPES.COAL,
        0.05,       // scale (适中频率)
        0.03,       // threshold (狭窄的脊线区间，确保矿脉纤细连续)
        260,        // maxLevel
        0.75,       // densityCheck (矿脉密实度)
        10          // priority
      )
    );

    // 连续铁矿脉 (全局高度 180 以下)
    this.register(
      new VeinOreGenerator(
        'vein_iron',
        BLOCK_TYPES.IRON,
        0.06,       // scale
        0.025,      // threshold
        180,        // maxLevel
        0.70,       // densityCheck
        10          // priority
      )
    );

    this.initialized = true;
  }

  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initDefaults();
    }
  }

  /**
   * 扫描并替换矿石的主入口。
   * @returns 替换后的 Block ID，若不生成矿石则返回 BLOCK_TYPES.STONE
   */
  public static generateOre(
    wx: number,
    wy: number,
    wz: number,
    noise: ImprovedNoise,
    biomeId: string
  ): number {
    this.ensureInitialized();

    for (const generator of this.generators) {
      const result = generator.generate(wx, wy, wz, noise, biomeId);
      if (result !== null) {
        return result;
      }
    }
    return BLOCK_TYPES.STONE;
  }
}
