import * as THREE from 'three';
import type { BlendedEnvironment, IWeather } from './EnvironmentTypes';
import { ClearWeather, RainWeather, StormWeather } from './WeatherPresets';

export class WeatherBlender {
  private weathers = new Map<string, IWeather>();
  private activeWeights = new Map<string, number>();

  // Pre-allocate the blended result structure to avoid garbage collection pressure
  private blendedResult: BlendedEnvironment = {
    skyColors: {
      skyStart: new THREE.Color(),
      skyEnd: new THREE.Color(),
      fogColor: new THREE.Color(),
      lightColor: new THREE.Color(),
    },
    ambientColor: new THREE.Color(),
    ambientIntensity: 0,
    dirLightIntensity: 0,
    dirLightColor: new THREE.Color(),
    fogDensity: 0,
  };

  constructor() {
    this.registerWeather(new ClearWeather());
    this.registerWeather(new RainWeather());
    this.registerWeather(new StormWeather());
  }

  public registerWeather(weather: IWeather) {
    this.weathers.set(weather.id, weather);
  }

  public blend(timeRatio: number, weatherWeights: Map<string, number>): BlendedEnvironment {
    // 1. Gather all weights, filter out weights <= 0, and compute sum
    let totalWeight = 0;
    this.activeWeights.clear();

    for (const [id, weight] of weatherWeights.entries()) {
      if (this.weathers.has(id) && weight > 0) {
        this.activeWeights.set(id, weight);
        totalWeight += weight;
      }
    }

    // Default to 'clear' weather if no active weather weights are found
    if (totalWeight <= 0) {
      this.activeWeights.set('clear', 1.0);
      totalWeight = 1.0;
    }

    // Normalize weights so they sum to 1.0
    for (const [id, weight] of this.activeWeights.entries()) {
      this.activeWeights.set(id, weight / totalWeight);
    }

    // 2. Blend the environmental properties
    const res = this.blendedResult;
    res.skyColors.skyStart.setRGB(0, 0, 0);
    res.skyColors.skyEnd.setRGB(0, 0, 0);
    res.skyColors.fogColor.setRGB(0, 0, 0);
    res.skyColors.lightColor.setRGB(0, 0, 0);

    let blendedAmbientIntensity = 0;
    let blendedDirLightIntensity = 0;
    let blendedFogDensity = 0;

    for (const [id, normWeight] of this.activeWeights.entries()) {
      const weather = this.weathers.get(id)!;
      const colors = weather.getSkyColors(timeRatio);

      // Interpolate colors manually
      res.skyColors.skyStart.r += colors.skyStart.r * normWeight;
      res.skyColors.skyStart.g += colors.skyStart.g * normWeight;
      res.skyColors.skyStart.b += colors.skyStart.b * normWeight;

      res.skyColors.skyEnd.r += colors.skyEnd.r * normWeight;
      res.skyColors.skyEnd.g += colors.skyEnd.g * normWeight;
      res.skyColors.skyEnd.b += colors.skyEnd.b * normWeight;

      res.skyColors.fogColor.r += colors.fogColor.r * normWeight;
      res.skyColors.fogColor.g += colors.fogColor.g * normWeight;
      res.skyColors.fogColor.b += colors.fogColor.b * normWeight;

      res.skyColors.lightColor.r += colors.lightColor.r * normWeight;
      res.skyColors.lightColor.g += colors.lightColor.g * normWeight;
      res.skyColors.lightColor.b += colors.lightColor.b * normWeight;

      // Interpolate float values
      blendedAmbientIntensity += weather.getAmbientIntensity(timeRatio) * normWeight;
      blendedDirLightIntensity += weather.getDirLightIntensity(timeRatio) * normWeight;
      blendedFogDensity += weather.getFogDensity(timeRatio) * normWeight;
    }

    // Calculate ambient light color - usually similar to sky color or slightly adjusted
    // In our design, ambient color is blended from skyStart and lightColor for premium depth
    res.ambientColor.copy(res.skyColors.skyEnd).lerp(res.skyColors.lightColor, 0.2);
    res.dirLightColor.copy(res.skyColors.lightColor);

    res.ambientIntensity = blendedAmbientIntensity;
    res.dirLightIntensity = blendedDirLightIntensity;
    res.fogDensity = blendedFogDensity;

    return res;
  }
}
