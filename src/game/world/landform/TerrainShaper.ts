import { ImprovedNoise } from '../Noise';
import { WORLD_CONFIG } from '../WorldConfig';

class SplinePoint {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class Spline {
  private points: SplinePoint[];
  constructor(points: SplinePoint[]) {
    this.points = points;
    // Ensure points are sorted by x
    this.points.sort((a, b) => a.x - b.x);
  }
  
  public evaluate(x: number): number {
    if (x <= this.points[0].x) return this.points[0].y;
    if (x >= this.points[this.points.length - 1].x) return this.points[this.points.length - 1].y;
    
    for (let i = 0; i < this.points.length - 1; i++) {
      const p0 = this.points[i];
      const p1 = this.points[i+1];
      if (x >= p0.x && x <= p1.x) {
        const t = (x - p0.x) / (p1.x - p0.x);
        // Smoothstep interpolation for organic terrain curves
        const smoothT = t * t * (3 - 2 * t);
        return p0.y + (p1.y - p0.y) * smoothT;
      }
    }
    return 0;
  }
}

export class TerrainShaper {
  private static continentalitySpline: Spline | null = null;
  private static lastOceanThreshold: number = -1;

  private static erosionHeightOffsetSpline = new Spline([
    new SplinePoint(0.00, 55), // Extremely high mountains (low erosion)
    new SplinePoint(0.20, 35),
    new SplinePoint(0.40, 10),
    new SplinePoint(0.55, 0),
    new SplinePoint(1.00, -5), // Lowlands/Plains (high erosion)
  ]);

  private static erosionVarianceSpline = new Spline([
    new SplinePoint(0.00, 65), // Jagged peaks amplitude
    new SplinePoint(0.20, 45),
    new SplinePoint(0.40, 15),
    new SplinePoint(0.60, 5),  // Rolling hills
    new SplinePoint(0.80, 3),  // Flat plains
    new SplinePoint(1.00, 1),
  ]);

  private static getContinentalitySpline(): Spline {
    const threshold = WORLD_CONFIG.ocean.threshold;
    if (this.lastOceanThreshold !== threshold || !this.continentalitySpline) {
      this.lastOceanThreshold = threshold;
      this.continentalitySpline = new Spline([
        new SplinePoint(0.00, 80),
        new SplinePoint(Math.max(0.01, threshold - 0.15), 100),
        new SplinePoint(Math.max(0.02, threshold - 0.05), 135),
        new SplinePoint(threshold, WORLD_CONFIG.waterLevel), // Exactly at threshold = water level
        new SplinePoint(Math.min(0.97, threshold + 0.02), 152), // Beach/Shore
        new SplinePoint(Math.min(0.98, threshold + 0.15), 156), // Inland plains
        new SplinePoint(Math.min(0.99, threshold + 0.45), 165), // Highlands
        new SplinePoint(1.00, 180),
      ]);
    }
    return this.continentalitySpline;
  }

  private static getErosionEffectScale(c: number): number {
    const threshold = WORLD_CONFIG.ocean.threshold;
    // Scale down erosion effects underwater to avoid massive sea mounts unless intended
    const oceanDepthStart = Math.max(0.0, threshold - 0.05);
    if (c < oceanDepthStart) return 0.25; 
    if (c < threshold + 0.02) {
      const t = (c - oceanDepthStart) / (threshold + 0.02 - oceanDepthStart);
      return 0.25 + (1.0 - 0.25) * t;
    }
    return 1.0;
  }

  public static getHeight(wx: number, wz: number, noise: ImprovedNoise, c: number, e: number): number {
    const spline = this.getContinentalitySpline();
    const baseHeight = spline.evaluate(c);
    
    const erosionScale = this.getErosionEffectScale(c);
    const heightOffset = this.erosionHeightOffsetSpline.evaluate(e) * erosionScale;
    const variance = this.erosionVarianceSpline.evaluate(e) * erosionScale;
    
    // Base FBM noise for terrain shape
    const rawFbm = noise.fbm(wx * 0.007, wz * 0.007, 4, 0.45);
    
    // To support mountains (which previously used ridge noise 1.0 - Math.abs(rawFbm)),
    // we blend between normal FBM and ridge based on erosion!
    const ridgeNoise = 1.0 - Math.abs(rawFbm);
    
    let shapeNoise: number;
    if (e < 0.25) {
      shapeNoise = ridgeNoise; // Pure ridge for mountains
    } else if (e < 0.40) {
      const t = (e - 0.25) / 0.15; // 0 to 1
      shapeNoise = ridgeNoise + (rawFbm - ridgeNoise) * t; // Blend
    } else {
      shapeNoise = rawFbm; // Normal rolling terrain
    }
    
    // Sub-noise for micro-details (e.g. bumpy grass)
    const microNoise = noise.noise(wx * 0.05, wz * 0.05) * 1.5;

    const terrainHeight = baseHeight + heightOffset + shapeNoise * variance + microNoise;
    
    return Math.floor(terrainHeight);
  }
}
