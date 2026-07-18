import * as THREE from 'three';
import {
  hashWeatherSeed,
  type WeatherId,
} from './WeatherTimeline';

interface PrecipitationModeConfig {
  readonly dropCount: number;
  readonly fallSpeed: number;
  readonly streakLength: number;
  readonly windOffset: number;
  readonly opacity: number;
}

export const PRECIPITATION_CONFIG = Object.freeze({
  capacity: 1024,
  horizontalRadius: 18,
  lowerBound: -10,
  upperBound: 14,
  respawnBandHeight: 4,
  maximumDeltaSeconds: 0.1,
  color: 0xb9d8ea,
  rain: Object.freeze({
    dropCount: 576,
    fallSpeed: 24,
    streakLength: 0.9,
    windOffset: 0.08,
    opacity: 0.55,
  }),
  storm: Object.freeze({
    dropCount: 1024,
    fallSpeed: 34,
    streakLength: 1.4,
    windOffset: 0.22,
    opacity: 0.78,
  }),
} as const satisfies {
  readonly capacity: number;
  readonly horizontalRadius: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly respawnBandHeight: number;
  readonly maximumDeltaSeconds: number;
  readonly color: number;
  readonly rain: PrecipitationModeConfig;
  readonly storm: PrecipitationModeConfig;
});

const POSITION_VALUES_PER_DROP = 6;
const UINT32_MAX = 0xffffffff;
const PARTICLE_SEED_FACTOR = 0x9e3779b1;
const NON_ZERO_RANDOM_STATE = 0x6d2b79f5;
const MINIMUM_SPEED_FACTOR = 0.75;
const SPEED_FACTOR_RANGE = 0.5;

/**
 * Owns one fixed line buffer for precipitation. Drops remain local to the
 * camera and mutate typed arrays in place on every update.
 */
export class PrecipitationRenderer {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly positions: Float32Array;
  private readonly speedFactors: Float32Array;
  private readonly randomStates: Uint32Array;
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.LineBasicMaterial;
  private readonly lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private disposed = false;

  constructor(scene: THREE.Scene, camera: THREE.Camera, seed: string) {
    this.scene = scene;
    this.camera = camera;
    this.positions = new Float32Array(
      PRECIPITATION_CONFIG.capacity * POSITION_VALUES_PER_DROP,
    );
    this.speedFactors = new Float32Array(PRECIPITATION_CONFIG.capacity);
    this.randomStates = new Uint32Array(PRECIPITATION_CONFIG.capacity);

    const seedHash = hashWeatherSeed(seed);
    for (let index = 0; index < PRECIPITATION_CONFIG.capacity; index++) {
      const state = (seedHash ^ Math.imul(index + 1, PARTICLE_SEED_FACTOR)) >>> 0;
      this.randomStates[index] = state || NON_ZERO_RANDOM_STATE;
      this.initializeDrop(index);
    }

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.LineBasicMaterial({
      color: PRECIPITATION_CONFIG.color,
      transparent: true,
      opacity: PRECIPITATION_CONFIG.rain.opacity,
      depthWrite: false,
      fog: true,
    });
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.scene.add(this.lines);
  }

  public update(dt: number, weatherId: WeatherId): void {
    if (this.disposed) {
      return;
    }

    this.lines.position.copy(this.camera.position);
    const mode = this.getMode(weatherId);
    if (mode === null) {
      this.lines.visible = false;
      this.geometry.setDrawRange(0, 0);
      return;
    }

    this.lines.visible = true;
    this.material.opacity = mode.opacity;
    this.geometry.setDrawRange(0, mode.dropCount * 2);

    const clampedDelta = Number.isFinite(dt)
      ? Math.max(0, Math.min(dt, PRECIPITATION_CONFIG.maximumDeltaSeconds))
      : 0;
    // 水平漂移与线段倾斜一致：每下落 streakLength 单位，X 偏移 windOffset
    const windDriftPerUnitFall = mode.windOffset / mode.streakLength;
    for (let index = 0; index < mode.dropCount; index++) {
      const offset = index * POSITION_VALUES_PER_DROP;
      const fallDistance = mode.fallSpeed * this.speedFactors[index] * clampedDelta;
      let x = this.positions[offset] + fallDistance * windDriftPerUnitFall;
      let y = this.positions[offset + 1] - fallDistance;

      if (y < PRECIPITATION_CONFIG.lowerBound) {
        x = this.randomHorizontalPosition(index);
        y = PRECIPITATION_CONFIG.upperBound
          + this.nextRandom(index) * PRECIPITATION_CONFIG.respawnBandHeight;
        this.positions[offset + 2] = this.randomHorizontalPosition(index);
      }

      this.positions[offset] = x;
      this.positions[offset + 1] = y;
      this.positions[offset + 3] = x + mode.windOffset;
      this.positions[offset + 4] = y - mode.streakLength;
      this.positions[offset + 5] = this.positions[offset + 2];
    }
    this.positionAttribute.needsUpdate = true;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.scene.remove(this.lines);
    this.geometry.dispose();
    this.material.dispose();
  }

  private initializeDrop(index: number): void {
    const offset = index * POSITION_VALUES_PER_DROP;
    const heightRange = PRECIPITATION_CONFIG.upperBound
      - PRECIPITATION_CONFIG.lowerBound;
    const x = this.randomHorizontalPosition(index);
    const y = PRECIPITATION_CONFIG.lowerBound + this.nextRandom(index) * heightRange;
    const z = this.randomHorizontalPosition(index);

    this.positions[offset] = x;
    this.positions[offset + 1] = y;
    this.positions[offset + 2] = z;
    this.positions[offset + 3] = x + PRECIPITATION_CONFIG.rain.windOffset;
    this.positions[offset + 4] = y - PRECIPITATION_CONFIG.rain.streakLength;
    this.positions[offset + 5] = z;
    this.speedFactors[index] = MINIMUM_SPEED_FACTOR
      + this.nextRandom(index) * SPEED_FACTOR_RANGE;
  }

  private randomHorizontalPosition(index: number): number {
    return (this.nextRandom(index) * 2 - 1) * PRECIPITATION_CONFIG.horizontalRadius;
  }

  private nextRandom(index: number): number {
    let state = this.randomStates[index];
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    this.randomStates[index] = state || NON_ZERO_RANDOM_STATE;
    return this.randomStates[index] / UINT32_MAX;
  }

  private getMode(weatherId: WeatherId): PrecipitationModeConfig | null {
    if (weatherId === 'rain') {
      return PRECIPITATION_CONFIG.rain;
    }
    if (weatherId === 'storm') {
      return PRECIPITATION_CONFIG.storm;
    }
    return null;
  }
}
