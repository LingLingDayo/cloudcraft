import { ImprovedNoise } from '../Noise';
import {
  type Landform,
  OceanLandform,
  PlainsLandform,
  HillsLandform,
  PlateauLandform,
  MountainsLandform,
} from './Landform';
import { WORLD_CONFIG } from '../WorldConfig';

class LandformRegistryClass {
  private landforms: Landform[] = [];

  constructor() {
    this.register(new OceanLandform());
    this.register(new PlainsLandform());
    this.register(new HillsLandform());
    this.register(new PlateauLandform());
    this.register(new MountainsLandform());
  }

  public register(landform: Landform): void {
    this.landforms.push(landform);
  }

  public getLandformAt(wx: number, wz: number, noise: ImprovedNoise): Landform {
    const scale = WORLD_CONFIG.landform.scale;
    
    // 大陆度 (Continentalness)
    const c = (noise.noise((wx + WORLD_CONFIG.landform.offsetC) * scale, (wz + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;
    // 侵蚀度 (Erosion)
    const e = (noise.noise((wx + WORLD_CONFIG.landform.offsetE) * scale, (wz + WORLD_CONFIG.landform.offsetE) * scale) + 1) / 2;

    let nearestLandform = this.landforms[0];
    let minDistanceSq = Infinity;

    // 欧式空间最近邻匹配
    for (const landform of this.landforms) {
      const dc = c - landform.targetContinentalness;
      const de = e - landform.targetErosion;
      const distSq = dc * dc + de * de;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        nearestLandform = landform;
      }
    }

    return nearestLandform;
  }

  public get OCEAN() { return this.landforms.find(l => l.id === 'ocean')!; }
  public get PLAINS() { return this.landforms.find(l => l.id === 'plains')!; }
  public get HILLS() { return this.landforms.find(l => l.id === 'hills')!; }
  public get PLATEAU() { return this.landforms.find(l => l.id === 'plateau')!; }
  public get MOUNTAINS() { return this.landforms.find(l => l.id === 'mountains')!; }

  public getLandforms(): readonly Landform[] {
    return this.landforms;
  }
}

export const LandformRegistry = new LandformRegistryClass();

export function getLandformAt(wx: number, wz: number, noise: ImprovedNoise): Landform {
  return LandformRegistry.getLandformAt(wx, wz, noise);
}
