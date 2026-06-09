export interface Landform {
  id: string;
  name: string;
  targetContinentalness: number; // 大陆度
  targetErosion: number;         // 侵蚀度
}

export class OceanLandform implements Landform {
  public id = 'ocean';
  public name = '海洋';
  public targetContinentalness = 0.1;
  public targetErosion = 0.5;
}

export class PlainsLandform implements Landform {
  public id = 'plains';
  public name = '平原';
  public targetContinentalness = 0.5;
  public targetErosion = 0.8;
}

export class HillsLandform implements Landform {
  public id = 'hills';
  public name = '丘陵';
  public targetContinentalness = 0.5;
  public targetErosion = 0.5;
}

export class PlateauLandform implements Landform {
  public id = 'plateau';
  public name = '高原';
  public targetContinentalness = 0.7;
  public targetErosion = 0.7;
}

export class MountainsLandform implements Landform {
  public id = 'mountains';
  public name = '山地';
  public targetContinentalness = 0.85;
  public targetErosion = 0.2;
}
