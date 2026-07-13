export const WEATHER_IDS = ['clear', 'rain', 'storm'] as const;

export type WeatherId = (typeof WEATHER_IDS)[number];

const WEATHER_PATTERN = [
  'clear',
  'rain',
  'clear',
  'storm',
  'clear',
  'rain',
] as const satisfies readonly WeatherId[];

export const WEATHER_TIMELINE_CONFIG = Object.freeze({
  snapshotSchemaVersion: 1,
  fragmentDurationSeconds: 45,
  timeUnitsPerSecond: 1_000_000_000,
  transitionSpeedPerSecond: 0.2,
  defaultSeed: 'cloudcraft',
  pattern: Object.freeze(WEATHER_PATTERN),
} as const);

export interface WeatherSnapshot {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly elapsedSeconds: number;
  readonly manualWeather: WeatherId | null;
}

const HASH_OFFSET_BASIS = 0x811c9dc5;
const HASH_PRIME = 0x01000193;

export function hashWeatherSeed(seed: string): number {
  let hash = HASH_OFFSET_BASIS;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, HASH_PRIME);
  }
  return hash >>> 0;
}

export function isWeatherId(value: unknown): value is WeatherId {
  return value === 'clear' || value === 'rain' || value === 'storm';
}

export function validateWeatherSnapshot(
  snapshot: unknown,
): asserts snapshot is WeatherSnapshot {
  if (typeof snapshot !== 'object' || snapshot === null) {
    throw new Error('Weather snapshot must be an object');
  }

  const candidate = snapshot as Partial<WeatherSnapshot>;
  if (candidate.schemaVersion !== WEATHER_TIMELINE_CONFIG.snapshotSchemaVersion) {
    throw new Error(
      `Unsupported weather snapshot schema version: ${String(candidate.schemaVersion)}`,
    );
  }
  if (typeof candidate.seed !== 'string' || candidate.seed.length === 0) {
    throw new Error('Weather snapshot seed must be a non-empty string');
  }
  if (!Number.isFinite(candidate.elapsedSeconds) || candidate.elapsedSeconds! < 0) {
    throw new Error('Weather snapshot elapsedSeconds must be a finite non-negative number');
  }
  if (candidate.manualWeather !== null && !isWeatherId(candidate.manualWeather)) {
    throw new Error(`Unknown weather id: ${String(candidate.manualWeather)}`);
  }
}

/**
 * Derives weather from a seed and fixed time fragments without maintaining a
 * mutable random generator, so update cadence cannot change the sequence.
 */
export class WeatherTimeline {
  private seed: string;
  private seedHash: number;
  private elapsedTimeUnits = 0;
  private fractionalTimeUnits = 0;
  private manualWeather: WeatherId | null = null;

  constructor(seed: string = WEATHER_TIMELINE_CONFIG.defaultSeed) {
    this.seed = seed || WEATHER_TIMELINE_CONFIG.defaultSeed;
    this.seedHash = hashWeatherSeed(this.seed);
  }

  public update(dt: number): WeatherId {
    if (Number.isFinite(dt) && dt > 0) {
      const cycleTimeUnits = this.getCycleTimeUnits();
      const cycleDurationSeconds = this.getCycleDurationSeconds();
      const normalizedSeconds = dt % cycleDurationSeconds;
      const pendingTimeUnits = normalizedSeconds
        * WEATHER_TIMELINE_CONFIG.timeUnitsPerSecond
        + this.fractionalTimeUnits;
      const deltaTimeUnits = Math.trunc(pendingTimeUnits) % cycleTimeUnits;
      this.fractionalTimeUnits = pendingTimeUnits - Math.trunc(pendingTimeUnits);
      this.elapsedTimeUnits = (this.elapsedTimeUnits + deltaTimeUnits) % cycleTimeUnits;
    }
    return this.getWeather();
  }

  public getWeather(): WeatherId {
    return this.manualWeather ?? this.getAutomaticWeather();
  }

  public setManualWeather(weatherId: WeatherId): void {
    if (!isWeatherId(weatherId)) {
      throw new Error(`Unknown weather id: ${String(weatherId)}`);
    }
    this.manualWeather = weatherId;
  }

  public resumeAutomaticWeather(): void {
    this.manualWeather = null;
  }

  public createSnapshot(): WeatherSnapshot {
    return {
      schemaVersion: WEATHER_TIMELINE_CONFIG.snapshotSchemaVersion,
      seed: this.seed,
      elapsedSeconds: this.getEffectiveElapsedTimeUnits()
        / WEATHER_TIMELINE_CONFIG.timeUnitsPerSecond,
      manualWeather: this.manualWeather,
    };
  }

  public restoreSnapshot(snapshot: WeatherSnapshot): void {
    validateWeatherSnapshot(snapshot);

    this.seed = snapshot.seed;
    this.seedHash = hashWeatherSeed(snapshot.seed);
    const normalizedSeconds = snapshot.elapsedSeconds % this.getCycleDurationSeconds();
    this.elapsedTimeUnits = Math.round(
      normalizedSeconds * WEATHER_TIMELINE_CONFIG.timeUnitsPerSecond,
    ) % this.getCycleTimeUnits();
    this.fractionalTimeUnits = 0;
    this.manualWeather = snapshot.manualWeather;
  }

  private getAutomaticWeather(): WeatherId {
    const pattern = WEATHER_TIMELINE_CONFIG.pattern;
    const fragmentTimeUnits = WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds
      * WEATHER_TIMELINE_CONFIG.timeUnitsPerSecond;
    const fragmentIndex = Math.floor(
      this.getEffectiveElapsedTimeUnits() / fragmentTimeUnits,
    );
    const offset = this.seedHash % pattern.length;
    const direction = (this.seedHash & 1) === 0 ? 1 : -1;
    const rawIndex = offset + fragmentIndex * direction;
    const patternIndex = ((rawIndex % pattern.length) + pattern.length) % pattern.length;
    return pattern[patternIndex];
  }

  private getCycleDurationSeconds(): number {
    return WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds
      * WEATHER_TIMELINE_CONFIG.pattern.length;
  }

  private getCycleTimeUnits(): number {
    return this.getCycleDurationSeconds() * WEATHER_TIMELINE_CONFIG.timeUnitsPerSecond;
  }

  private getEffectiveElapsedTimeUnits(): number {
    return Math.round(this.elapsedTimeUnits + this.fractionalTimeUnits)
      % this.getCycleTimeUnits();
  }
}
