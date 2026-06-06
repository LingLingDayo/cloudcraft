import { ImprovedNoise } from '../Noise';

export interface OreGenerator {
  id: string;
  priority: number;
  
  /**
   * 判断并在该坐标生成对应的矿石类型。
   * @returns 目标方块 ID，若不生成则返回 null。
   */
  generate(
    wx: number,
    wy: number,
    wz: number,
    noise: ImprovedNoise,
    biomeId: string
  ): number | null;
}

/**
 * 经典单点/点状随机矿石生成器。
 * 对应原有的伪随机点状分布，在低于 maxLevel 的空间按一定概率独立发生。
 */
export class PointOreGenerator implements OreGenerator {
  public id: string;
  public blockType: number;
  public probability: number;
  public maxLevel: number;
  public priority: number;
  public allowedBiomes?: string[];

  constructor(
    id: string,
    blockType: number,
    probability: number,
    maxLevel: number,
    priority: number = 0,
    allowedBiomes?: string[]
  ) {
    this.id = id;
    this.blockType = blockType;
    this.probability = probability;
    this.maxLevel = maxLevel;
    this.priority = priority;
    this.allowedBiomes = allowedBiomes;
  }

  public generate(
    wx: number,
    wy: number,
    wz: number,
    noise: ImprovedNoise,
    biomeId: string
  ): number | null {
    if (wy >= this.maxLevel) {
      return null;
    }
    if (this.allowedBiomes && !this.allowedBiomes.includes(biomeId)) {
      return null;
    }

    const r = noise.pseudoRandom3d(wx, wy, wz);
    if (r < this.probability) {
      return this.blockType;
    }
    return null;
  }
}

/**
 * 新型三维连续矿脉生成器。
 * 使用 3D 噪声脊线，在地下形成蔓延的藤蔓/管道状连续矿脉。
 */
export class VeinOreGenerator implements OreGenerator {
  public id: string;
  public blockType: number;
  public scale: number;
  public threshold: number;
  public maxLevel: number;
  public densityCheck: number;
  public priority: number;
  public allowedBiomes?: string[];

  constructor(
    id: string,
    blockType: number,
    scale: number,
    threshold: number,
    maxLevel: number,
    densityCheck: number,
    priority: number = 0,
    allowedBiomes?: string[]
  ) {
    this.id = id;
    this.blockType = blockType;
    this.scale = scale;
    this.threshold = threshold;
    this.maxLevel = maxLevel;
    this.densityCheck = densityCheck;
    this.priority = priority;
    this.allowedBiomes = allowedBiomes;
  }

  public generate(
    wx: number,
    wy: number,
    wz: number,
    noise: ImprovedNoise,
    biomeId: string
  ): number | null {
    if (wy >= this.maxLevel) {
      return null;
    }
    if (this.allowedBiomes && !this.allowedBiomes.includes(biomeId)) {
      return null;
    }

    // 采用 3D Perlin 噪声计算在该坐标的连续流形数值
    const n = noise.noise3d(wx * this.scale, wy * this.scale, wz * this.scale);
    
    // 当 n 的绝对值接近 0 时生成连续的细长线状矿脉
    if (Math.abs(n) < this.threshold) {
      // 通过 pseudoRandom3d 带来细微的非连续孔洞，让矿脉更自然
      const density = noise.pseudoRandom3d(wx, wy, wz);
      if (density < this.densityCheck) {
        return this.blockType;
      }
    }
    return null;
  }
}
