import * as THREE from 'three';
import type { IWeather, SkyColors } from './EnvironmentTypes';

interface Keyframe {
  time: number;
  skyStart: THREE.Color;
  skyEnd: THREE.Color;
  fogColor: THREE.Color;
  lightColor: THREE.Color;
  ambientIntensity: number;
  dirLightIntensity: number;
}

function interpolateKeyframes(timeRatio: number, keyframes: Keyframe[]): Omit<Keyframe, 'time'> {
  const t = Math.max(0, Math.min(1, timeRatio));

  let lower = keyframes[0];
  let upper = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (t >= keyframes[i].time && t <= keyframes[i + 1].time) {
      lower = keyframes[i];
      upper = keyframes[i + 1];
      break;
    }
  }

  const range = upper.time - lower.time;
  const blend = range > 0 ? (t - lower.time) / range : 0;
  const smoothBlend = (1 - Math.cos(blend * Math.PI)) / 2;

  return {
    skyStart: lower.skyStart.clone().lerp(upper.skyStart, smoothBlend),
    skyEnd: lower.skyEnd.clone().lerp(upper.skyEnd, smoothBlend),
    fogColor: lower.fogColor.clone().lerp(upper.fogColor, smoothBlend),
    lightColor: lower.lightColor.clone().lerp(upper.lightColor, smoothBlend),
    ambientIntensity: lower.ambientIntensity + (upper.ambientIntensity - lower.ambientIntensity) * smoothBlend,
    dirLightIntensity: lower.dirLightIntensity + (upper.dirLightIntensity - lower.dirLightIntensity) * smoothBlend,
  };
}

export class ClearWeather implements IWeather {
  public id = 'clear';
  private lastTimeRatio = -1;
  private cachedData?: Omit<Keyframe, 'time'>;

  private keyframes: Keyframe[] = [
    {
      time: 0.0,
      skyStart: new THREE.Color(0x0e0e20),
      skyEnd: new THREE.Color(0xfb9062),
      fogColor: new THREE.Color(0xfb9062),
      lightColor: new THREE.Color(0xffaa66),
      ambientIntensity: 0.3,
      dirLightIntensity: 0.5,
    },
    {
      time: 0.25,
      skyStart: new THREE.Color(0x7ec0ee),
      skyEnd: new THREE.Color(0x7ec0ee),
      fogColor: new THREE.Color(0x7ec0ee),
      lightColor: new THREE.Color(0xffffff),
      ambientIntensity: 0.7,
      dirLightIntensity: 1.4,
    },
    {
      time: 0.5,
      skyStart: new THREE.Color(0x0e0e20),
      skyEnd: new THREE.Color(0xfb9062),
      fogColor: new THREE.Color(0xfb9062),
      lightColor: new THREE.Color(0xffaa66),
      ambientIntensity: 0.3,
      dirLightIntensity: 0.5,
    },
    {
      time: 0.75,
      skyStart: new THREE.Color(0x0a0a14),
      skyEnd: new THREE.Color(0x0a0a14),
      fogColor: new THREE.Color(0x0a0a14),
      lightColor: new THREE.Color(0xaabbff),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.2,
    },
    {
      time: 1.0,
      skyStart: new THREE.Color(0x0e0e20),
      skyEnd: new THREE.Color(0xfb9062),
      fogColor: new THREE.Color(0xfb9062),
      lightColor: new THREE.Color(0xffaa66),
      ambientIntensity: 0.3,
      dirLightIntensity: 0.5,
    },
  ];

  private getInterpolatedData(timeRatio: number): Omit<Keyframe, 'time'> {
    if (this.lastTimeRatio === timeRatio && this.cachedData) {
      return this.cachedData;
    }
    this.lastTimeRatio = timeRatio;
    this.cachedData = interpolateKeyframes(timeRatio, this.keyframes);
    return this.cachedData;
  }

  public getSkyColors(timeRatio: number): SkyColors {
    const data = this.getInterpolatedData(timeRatio);
    return {
      skyStart: data.skyStart,
      skyEnd: data.skyEnd,
      fogColor: data.fogColor,
      lightColor: data.lightColor,
    };
  }

  public getAmbientIntensity(timeRatio: number): number {
    return this.getInterpolatedData(timeRatio).ambientIntensity;
  }

  public getDirLightIntensity(timeRatio: number): number {
    return this.getInterpolatedData(timeRatio).dirLightIntensity;
  }

  public getFogDensity(_timeRatio: number): number {
    return 0.015;
  }
}

export class RainWeather implements IWeather {
  public id = 'rain';
  private lastTimeRatio = -1;
  private cachedData?: Omit<Keyframe, 'time'>;

  private keyframes: Keyframe[] = [
    {
      time: 0.0,
      skyStart: new THREE.Color(0x2a3038),
      skyEnd: new THREE.Color(0x3a424d),
      fogColor: new THREE.Color(0x30363f),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.15,
    },
    {
      time: 0.25,
      skyStart: new THREE.Color(0x444f5a),
      skyEnd: new THREE.Color(0x5a6978),
      fogColor: new THREE.Color(0x4c5865),
      lightColor: new THREE.Color(0xcccccc),
      ambientIntensity: 0.25,
      dirLightIntensity: 0.35,
    },
    {
      time: 0.5,
      skyStart: new THREE.Color(0x2a3038),
      skyEnd: new THREE.Color(0x3a424d),
      fogColor: new THREE.Color(0x30363f),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.15,
    },
    {
      time: 0.75,
      skyStart: new THREE.Color(0x0a0c10),
      skyEnd: new THREE.Color(0x101318),
      fogColor: new THREE.Color(0x0c0e12),
      lightColor: new THREE.Color(0x556688),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.05,
    },
    {
      time: 1.0,
      skyStart: new THREE.Color(0x2a3038),
      skyEnd: new THREE.Color(0x3a424d),
      fogColor: new THREE.Color(0x30363f),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.15,
    },
  ];

  private getInterpolatedData(timeRatio: number): Omit<Keyframe, 'time'> {
    if (this.lastTimeRatio === timeRatio && this.cachedData) {
      return this.cachedData;
    }
    this.lastTimeRatio = timeRatio;
    this.cachedData = interpolateKeyframes(timeRatio, this.keyframes);
    return this.cachedData;
  }

  public getSkyColors(timeRatio: number): SkyColors {
    const data = this.getInterpolatedData(timeRatio);
    return {
      skyStart: data.skyStart,
      skyEnd: data.skyEnd,
      fogColor: data.fogColor,
      lightColor: data.lightColor,
    };
  }

  public getAmbientIntensity(timeRatio: number): number {
    return this.getInterpolatedData(timeRatio).ambientIntensity;
  }

  public getDirLightIntensity(timeRatio: number): number {
    return this.getInterpolatedData(timeRatio).dirLightIntensity;
  }

  public getFogDensity(_timeRatio: number): number {
    return 0.03;
  }
}

export class StormWeather implements IWeather {
  public id = 'storm';
  private lastTimeRatio = -1;
  private cachedData?: Omit<Keyframe, 'time'>;

  private keyframes: Keyframe[] = [
    {
      time: 0.0,
      skyStart: new THREE.Color(0x121418),
      skyEnd: new THREE.Color(0x1b1d24),
      fogColor: new THREE.Color(0x15171c),
      lightColor: new THREE.Color(0x555555),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.08,
    },
    {
      time: 0.25,
      skyStart: new THREE.Color(0x22252c),
      skyEnd: new THREE.Color(0x2d323b),
      fogColor: new THREE.Color(0x282b33),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.15,
    },
    {
      time: 0.5,
      skyStart: new THREE.Color(0x121418),
      skyEnd: new THREE.Color(0x1b1d24),
      fogColor: new THREE.Color(0x15171c),
      lightColor: new THREE.Color(0x555555),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.08,
    },
    {
      time: 0.75,
      skyStart: new THREE.Color(0x030406),
      skyEnd: new THREE.Color(0x06080b),
      fogColor: new THREE.Color(0x040508),
      lightColor: new THREE.Color(0x334466),
      ambientIntensity: 0.04,
      dirLightIntensity: 0.02,
    },
    {
      time: 1.0,
      skyStart: new THREE.Color(0x121418),
      skyEnd: new THREE.Color(0x1b1d24),
      fogColor: new THREE.Color(0x15171c),
      lightColor: new THREE.Color(0x555555),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.08,
    },
  ];

  private getInterpolatedData(timeRatio: number): Omit<Keyframe, 'time'> {
    if (this.lastTimeRatio === timeRatio && this.cachedData) {
      return this.cachedData;
    }
    this.lastTimeRatio = timeRatio;
    this.cachedData = interpolateKeyframes(timeRatio, this.keyframes);
    return this.cachedData;
  }

  public getSkyColors(timeRatio: number): SkyColors {
    const data = this.getInterpolatedData(timeRatio);
    return {
      skyStart: data.skyStart,
      skyEnd: data.skyEnd,
      fogColor: data.fogColor,
      lightColor: data.lightColor,
    };
  }

  public getAmbientIntensity(timeRatio: number): number {
    return this.getInterpolatedData(timeRatio).ambientIntensity;
  }

  public getDirLightIntensity(timeRatio: number): number {
    return this.getInterpolatedData(timeRatio).dirLightIntensity;
  }

  public getFogDensity(_timeRatio: number): number {
    return 0.045;
  }
}
