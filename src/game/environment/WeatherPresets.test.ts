import { describe, expect, test } from 'vitest';
import {
  ClearWeather,
  RainWeather,
  StormWeather,
} from './WeatherPresets';

describe('WeatherPresets sky color views', () => {
  test.each([
    ['clear', () => new ClearWeather()],
    ['rain', () => new RainWeather()],
    ['storm', () => new StormWeather()],
  ])('%s weather reuses one SkyColors view', (_weatherId, createWeather) => {
    const weather = createWeather();
    const first = weather.getSkyColors(0.1);
    const firstSkyStart = first.skyStart;
    const firstSkyEnd = first.skyEnd;
    const firstFogColor = first.fogColor;
    const firstLightColor = first.lightColor;

    const second = weather.getSkyColors(0.3);

    expect(second).toBe(first);
    expect(second.skyStart).toBe(firstSkyStart);
    expect(second.skyEnd).toBe(firstSkyEnd);
    expect(second.fogColor).toBe(firstFogColor);
    expect(second.lightColor).toBe(firstLightColor);
  });

  test('keeps normal rain close to clear daylight while storms remain substantially darker', () => {
    const clear = new ClearWeather();
    const rain = new RainWeather();
    const storm = new StormWeather();
    const noonTimeRatio = 0.25;
    const clearAmbient = clear.getAmbientIntensity(noonTimeRatio);
    const clearDirectional = clear.getDirLightIntensity(noonTimeRatio);
    const rainAmbient = rain.getAmbientIntensity(noonTimeRatio);
    const rainDirectional = rain.getDirLightIntensity(noonTimeRatio);

    expect(rainAmbient).toBeGreaterThanOrEqual(clearAmbient * 0.85);
    expect(rainAmbient).toBeLessThan(clearAmbient);
    expect(rainDirectional).toBeGreaterThanOrEqual(clearDirectional * 0.8);
    expect(rainDirectional).toBeLessThan(clearDirectional);
    expect(rain.getFogDensity(noonTimeRatio)).toBeLessThan(0.02);
    expect(storm.getAmbientIntensity(noonTimeRatio)).toBeLessThan(rainAmbient * 0.5);
    expect(storm.getDirLightIntensity(noonTimeRatio)).toBeLessThan(rainDirectional * 0.5);
  });
});
