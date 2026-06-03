export class ImprovedNoise {
  private p: Uint8Array;

  constructor(seed: string | number = 'minicraft') {
    this.p = new Uint8Array(512);
    this.seed(seed);
  }

  public seed(seed: string | number) {
    let hash = 0;
    const seedStr = seed.toString();
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }

    const permutation = Array.from({ length: 256 }, (_, i) => i);
    let r = Math.abs(hash);
    for (let i = 255; i > 0; i--) {
      r = (r * 9301 + 49297) % 233280;
      const j = Math.floor((r / 233280.0) * (i + 1));
      const temp = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = temp;
    }

    for (let i = 0; i < 256; i++) {
      this.p[i] = permutation[i];
      this.p[i + 256] = permutation[i];
    }
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  private grad3d(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  public noise3d(x: number, y: number, z: number): number {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);

    const X = floorX & 255;
    const Y = floorY & 255;
    const Z = floorZ & 255;

    const xf = x - floorX;
    const yf = y - floorY;
    const zf = z - floorZ;

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;

    return this.lerp(
      w,
      this.lerp(
        v,
        this.lerp(u, this.grad3d(this.p[AA], xf, yf, zf), this.grad3d(this.p[BA], xf - 1, yf, zf)),
        this.lerp(u, this.grad3d(this.p[AB], xf, yf - 1, zf), this.grad3d(this.p[BB], xf - 1, yf - 1, zf))
      ),
      this.lerp(
        v,
        this.lerp(u, this.grad3d(this.p[AA + 1], xf, yf, zf - 1), this.grad3d(this.p[BA + 1], xf - 1, yf, zf - 1)),
        this.lerp(u, this.grad3d(this.p[AB + 1], xf, yf - 1, zf - 1), this.grad3d(this.p[BB + 1], xf - 1, yf - 1, zf - 1))
      )
    );
  }

  public noise(x: number, y: number): number {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);

    const X = floorX & 255;
    const Y = floorY & 255;

    const xf = x - floorX;
    const yf = y - floorY;

    const u = this.fade(xf);
    const v = this.fade(yf);

    const A = this.p[X] + Y;
    const B = this.p[X + 1] + Y;

    return this.lerp(
      v,
      this.lerp(u, this.grad(this.p[A], xf, yf), this.grad(this.p[B], xf - 1, yf)),
      this.lerp(u, this.grad(this.p[A + 1], xf, yf - 1), this.grad(this.p[B + 1], xf - 1, yf - 1))
    );
  }

  public fbm(x: number, y: number, octaves = 4, persistence = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  }
}
