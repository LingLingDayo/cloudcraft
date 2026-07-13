import { describe, expect, test } from 'vitest';
import { Vector3 } from 'three';
import {
  WEATHER_IDS,
  WEATHER_TIMELINE_CONFIG,
  WeatherTimeline,
  type WeatherSnapshot,
} from './WeatherTimeline';
import { EnvironmentState } from './EnvironmentState';

describe('WeatherTimeline', () => {
  test('produces the same weather sequence for the same seed and elapsed time', () => {
    const first = new WeatherTimeline('test-weather-seed');
    const second = new WeatherTimeline('test-weather-seed');

    for (let index = 0; index < 12; index++) {
      const elapsed = WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds * 0.5;
      expect(first.update(elapsed)).toBe(second.update(elapsed));
    }

    expect(first.createSnapshot()).toEqual(second.createSnapshot());
  });

  test.each([14, 19, 33])(
    'lands on the same fragment boundary for one large step and %i small steps',
    stepCount => {
    const largeStep = new WeatherTimeline('test-weather-boundary-seed');
    const smallSteps = new WeatherTimeline('test-weather-boundary-seed');

    largeStep.update(WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds);
    for (let index = 0; index < stepCount; index++) {
      smallSteps.update(
        WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds / stepCount,
      );
    }

    expect(smallSteps.getWeather()).toBe(largeStep.getWeather());
    expect(smallSteps.createSnapshot()).toEqual(largeStep.createSnapshot());
    },
  );

  test('keeps elapsed time finite and weather valid after extreme finite updates', () => {
    const timeline = new WeatherTimeline('test-weather-overflow-seed');

    timeline.update(Number.MAX_VALUE);
    timeline.update(Number.MAX_VALUE);

    expect(Number.isFinite(timeline.createSnapshot().elapsedSeconds)).toBe(true);
    expect(WEATHER_IDS).toContain(timeline.getWeather());
  });

  test('automatically migrates between clear, rain and storm fragments', () => {
    const timeline = new WeatherTimeline('test-automatic-weather-seed');
    const observed = new Set([timeline.getWeather()]);

    for (let index = 0; index < WEATHER_TIMELINE_CONFIG.pattern.length; index++) {
      timeline.update(WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds);
      observed.add(timeline.getWeather());
    }

    expect(observed).toEqual(new Set(['clear', 'rain', 'storm']));
  });

  test('holds a manual weather override until automatic mode is resumed', () => {
    const automatic = new WeatherTimeline('test-manual-weather-seed');
    const overridden = new WeatherTimeline('test-manual-weather-seed');
    const elapsed = WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds * 4;

    overridden.setManualWeather('storm');
    expect(overridden.update(elapsed)).toBe('storm');

    automatic.update(elapsed);
    overridden.resumeAutomaticWeather();
    expect(overridden.getWeather()).toBe(automatic.getWeather());
  });

  test('restores a versioned snapshot and rejects an unsupported future version', () => {
    const source = new WeatherTimeline('test-snapshot-weather-seed');
    source.update(WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds * 2.5);
    source.setManualWeather('rain');

    const snapshot = source.createSnapshot();
    const restored = new WeatherTimeline('different-test-seed');
    restored.restoreSnapshot(snapshot);

    expect(restored.getWeather()).toBe('rain');
    expect(restored.createSnapshot()).toEqual(snapshot);

    const futureSnapshot = {
      ...snapshot,
      schemaVersion: snapshot.schemaVersion + 1,
    } as unknown as WeatherSnapshot;
    expect(() => restored.restoreSnapshot(futureSnapshot))
      .toThrowError('Unsupported weather snapshot schema version');
  });
});

describe('EnvironmentState weather integration', () => {
  test('drives automatic weather while preserving manual override compatibility', () => {
    const state = new EnvironmentState('test-environment-weather-seed');
    const automatic = new WeatherTimeline('test-environment-weather-seed');
    const cameraPosition = new Vector3(0, 80, 0);
    const elapsed = WEATHER_TIMELINE_CONFIG.fragmentDurationSeconds * 3;

    state.setWeather('storm');
    state.update(elapsed, cameraPosition, () => 0);
    expect(state.getWeather()).toBe('storm');

    automatic.update(elapsed);
    state.resumeAutomaticWeather();
    expect(state.getWeather()).toBe(automatic.getWeather());
  });
});
