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
});
