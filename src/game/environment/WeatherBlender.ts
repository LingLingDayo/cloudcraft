import * as THREE from 'three';
import type { BlendedEnvironment, IWeather, SkyColors } from './EnvironmentTypes';
import { ClearWeather, RainWeather, StormWeather } from './WeatherPresets';

export class WeatherBlender {
  private weathers = new Map<string, IWeather>();

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
    const activeWeights = new Map<string, number>();

    for (const [id, weight] of weatherWeights.entries()) {
      if (this.weathers.has(id) && weight > 0) {
        activeWeights.set(id, weight);
        totalWeight += weight;
      }
    }

    // Default to 'clear' weather if no active weather weights are found
    if (totalWeight <= 0) {
      activeWeights.set('clear', 1.0);
      totalWeight = 1.0;
    }

    // Normalize weights so they sum to 1.0
    for (const [id, weight] of activeWeights.entries()) {
      activeWeights.set(id, weight / totalWeight);
    }

    // 2. Blend the environmental properties
    const blendedSkyStart = new THREE.Color(0, 0, 0);
    const blendedSkyEnd = new THREE.Color(0, 0, 0);
    const blendedFogColor = new THREE.Color(0, 0, 0);
    const blendedLightColor = new THREE.Color(0, 0, 0);

    let blendedAmbientIntensity = 0;
    let blendedDirLightIntensity = 0;
    let blendedFogDensity = 0;

    for (const [id, normWeight] of activeWeights.entries()) {
      const weather = this.weathers.get(id)!;
      const colors = weather.getSkyColors(timeRatio);

      // Interpolate colors manually
      blendedSkyStart.r += colors.skyStart.r * normWeight;
      blendedSkyStart.g += colors.skyStart.g * normWeight;
      blendedSkyStart.b += colors.skyStart.b * normWeight;

      blendedSkyEnd.r += colors.skyEnd.r * normWeight;
      blendedSkyEnd.g += colors.skyEnd.g * normWeight;
      blendedSkyEnd.b += colors.skyEnd.b * normWeight;

      blendedFogColor.r += colors.fogColor.r * normWeight;
      blendedFogColor.g += colors.fogColor.g * normWeight;
      blendedFogColor.b += colors.fogColor.b * normWeight;

      blendedLightColor.r += colors.lightColor.r * normWeight;
      blendedLightColor.g += colors.lightColor.g * normWeight;
      blendedLightColor.b += colors.lightColor.b * normWeight;

      // Interpolate float values
      blendedAmbientIntensity += weather.getAmbientIntensity(timeRatio) * normWeight;
      blendedDirLightIntensity += weather.getDirLightIntensity(timeRatio) * normWeight;
      blendedFogDensity += weather.getFogDensity(timeRatio) * normWeight;
    }

    const blendedSkyColors: SkyColors = {
      skyStart: blendedSkyStart,
      skyEnd: blendedSkyEnd,
      fogColor: blendedFogColor,
      lightColor: blendedLightColor,
    };

    // Calculate ambient light color - usually similar to sky color or slightly adjusted
    // In our design, ambient color is blended from skyStart and lightColor for premium depth
    const ambientColor = blendedSkyColors.skyEnd.clone().lerp(blendedSkyColors.lightColor, 0.2);

    return {
      skyColors: blendedSkyColors,
      ambientColor,
      ambientIntensity: blendedAmbientIntensity,
      dirLightIntensity: blendedDirLightIntensity,
      dirLightColor: blendedSkyColors.lightColor,
      fogDensity: blendedFogDensity,
    };
  }
}
