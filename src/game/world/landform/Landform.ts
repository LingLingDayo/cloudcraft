import { ImprovedNoise } from '../Noise';
import { WORLD_CONFIG } from '../WorldConfig';

export interface Landform {
  id: string;
  name: string;
  targetContinentalness: number; // 大陆度
  targetErosion: number;         // 侵蚀度

  getHeight(
    wx: number,
    wz: number,
    noise: ImprovedNoise,
    continentalness: number,
    erosion: number
  ): number;
}

export class OceanLandform implements Landform {
  public id = 'ocean';
  public name = '海洋';
  public targetContinentalness = 0.1;
  public targetErosion = 0.5;

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 海洋深度：使用配置的海底基准高度与多维噪波起伏半振幅
    const depthNoise = noise.fbm(wx * 0.005, wz * 0.005, 3, 0.5);
    return Math.floor(WORLD_CONFIG.ocean.baseHeight + depthNoise * WORLD_CONFIG.ocean.variance);
  }
}

export class PlainsLandform implements Landform {
  public id = 'plains';
  public name = '平原';
  public targetContinentalness = 0.5;
  public targetErosion = 0.8;

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 平原：地势平缓，略高于海平面，平缓波动
    return Math.floor(155 + noise.fbm(wx * 0.008, wz * 0.008, 2, 0.3) * 4); // 151 ~ 159 格
  }
}

export class HillsLandform implements Landform {
  public id = 'hills';
  public name = '丘陵';
  public targetContinentalness = 0.5;
  public targetErosion = 0.5;

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 丘陵：中等高度，波浪式起伏
    return Math.floor(168 + noise.fbm(wx * 0.01, wz * 0.01, 3, 0.45) * 12); // 156 ~ 180 格
  }
}

export class PlateauLandform implements Landform {
  public id = 'plateau';
  public name = '高原';
  public targetContinentalness = 0.7;
  public targetErosion = 0.7;

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 高原：高海拔，但顶部较为平缓
    const baseHeight = 205;
    const flatNoise = noise.fbm(wx * 0.008, wz * 0.008, 2, 0.3) * 6;
    return Math.floor(baseHeight + flatNoise); // 199 ~ 211 格
  }
}

export class MountainsLandform implements Landform {
  public id = 'mountains';
  public name = '山地';
  public targetContinentalness = 0.85;
  public targetErosion = 0.2;

  public getHeight(wx: number, wz: number, noise: ImprovedNoise): number {
    // 山地：高耸峭立，使用脊线/绝对值噪波产生尖锐山峰
    const base = 180;
    const rawFbm = noise.fbm(wx * 0.006, wz * 0.006, 4, 0.55);
    // 采用脊线噪波效果生成更陡峭的山峰
    const ridge = 1.0 - Math.abs(rawFbm);
    return Math.floor(base + ridge * 65); // 180 ~ 245 格
  }
}
