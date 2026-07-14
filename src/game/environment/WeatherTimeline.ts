export const WEATHER_IDS = ['clear', 'rain', 'storm'] as const;

export type WeatherId = (typeof WEATHER_IDS)[number];

export interface WeatherPhase {
  readonly weatherId: WeatherId;
  readonly durationSeconds: number;
}

const WEATHER_PHASES = Object.freeze([
  Object.freeze({ weatherId: 'clear', durationSeconds: 180 }),
  Object.freeze({ weatherId: 'rain', durationSeconds: 120 }),
  Object.freeze({ weatherId: 'clear', durationSeconds: 240 }),
  Object.freeze({ weatherId: 'rain', durationSeconds: 180 }),
  Object.freeze({ weatherId: 'clear', durationSeconds: 300 }),
  Object.freeze({ weatherId: 'storm', durationSeconds: 90 }),
  Object.freeze({ weatherId: 'clear', durationSeconds: 210 }),
  Object.freeze({ weatherId: 'rain', durationSeconds: 150 }),
] as const satisfies readonly WeatherPhase[]);

const WEATHER_CYCLE_DURATION_SECONDS = WEATHER_PHASES.reduce(
  (total, phase) => total + phase.durationSeconds,
  0,
);

export const WEATHER_TIMELINE_CONFIG = Object.freeze({
  snapshotSchemaVersion: 1,
  cycleDurationSeconds: WEATHER_CYCLE_DURATION_SECONDS,
  timeUnitsPerSecond: 1_000_000_000,
  transitionSpeedPerSecond: 0.2,
  defaultSeed: 'cloudcraft',
  phases: WEATHER_PHASES,
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
 * Derives weather from seed-ordered phases without maintaining a
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
    const phases = WEATHER_TIMELINE_CONFIG.phases;
    const offset = this.seedHash % phases.length;
    const direction = (this.seedHash & 1) === 0 ? 1 : -1;
    let remainingTimeUnits = this.getEffectiveElapsedTimeUnits();

    for (let phaseOffset = 0; phaseOffset < phases.length; phaseOffset++) {
      const rawIndex = offset + phaseOffset * direction;
      const phaseIndex = ((rawIndex % phases.length) + phases.length) % phases.length;
      const phase = phases[phaseIndex];
      const phaseTimeUnits = phase.durationSeconds
        * WEATHER_TIMELINE_CONFIG.timeUnitsPerSecond;
      if (remainingTimeUnits < phaseTimeUnits) {
        return phase.weatherId;
      }
      remainingTimeUnits -= phaseTimeUnits;
    }

    return phases[offset].weatherId;
  }

  private getCycleDurationSeconds(): number {
    return WEATHER_TIMELINE_CONFIG.cycleDurationSeconds;
  }

  private getCycleTimeUnits(): number {
    return this.getCycleDurationSeconds() * WEATHER_TIMELINE_CONFIG.timeUnitsPerSecond;
  }

  private getEffectiveElapsedTimeUnits(): number {
    return Math.round(this.elapsedTimeUnits + this.fractionalTimeUnits)
      % this.getCycleTimeUnits();
  }
}
