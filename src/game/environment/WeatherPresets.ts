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

function interpolateKeyframes(timeRatio: number, keyframes: Keyframe[], target: Omit<Keyframe, 'time'>): void {
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

  target.skyStart.copy(lower.skyStart).lerp(upper.skyStart, smoothBlend);
  target.skyEnd.copy(lower.skyEnd).lerp(upper.skyEnd, smoothBlend);
  target.fogColor.copy(lower.fogColor).lerp(upper.fogColor, smoothBlend);
  target.lightColor.copy(lower.lightColor).lerp(upper.lightColor, smoothBlend);
  target.ambientIntensity = lower.ambientIntensity + (upper.ambientIntensity - lower.ambientIntensity) * smoothBlend;
  target.dirLightIntensity = lower.dirLightIntensity + (upper.dirLightIntensity - lower.dirLightIntensity) * smoothBlend;
}

export class ClearWeather implements IWeather {
  public id = 'clear';
  private lastTimeRatio = -1;
  private cachedData: Omit<Keyframe, 'time'> = {
    skyStart: new THREE.Color(),
    skyEnd: new THREE.Color(),
    fogColor: new THREE.Color(),
    lightColor: new THREE.Color(),
    ambientIntensity: 0,
    dirLightIntensity: 0,
  };

  private keyframes: Keyframe[] = [
    {
      time: 0.0, // Sunrise
      skyStart: new THREE.Color(0x0e0e20),
      skyEnd: new THREE.Color(0xfb9062),
      fogColor: new THREE.Color(0xfb9062),
      lightColor: new THREE.Color(0xffaa66),
      ambientIntensity: 0.3,
      dirLightIntensity: 0.5,
    },
    {
      time: 0.15, // Dawn transition ends
      skyStart: new THREE.Color(0x7ec0ee),
      skyEnd: new THREE.Color(0x7ec0ee),
      fogColor: new THREE.Color(0x7ec0ee),
      lightColor: new THREE.Color(0xffffff),
      ambientIntensity: 0.6,
      dirLightIntensity: 1.2,
    },
    {
      time: 0.25, // Noon
      skyStart: new THREE.Color(0x7ec0ee),
      skyEnd: new THREE.Color(0x7ec0ee),
      fogColor: new THREE.Color(0x7ec0ee),
      lightColor: new THREE.Color(0xffffff),
      ambientIntensity: 0.7,
      dirLightIntensity: 1.4,
    },
    {
      time: 0.35, // Afternoon
      skyStart: new THREE.Color(0x7ec0ee),
      skyEnd: new THREE.Color(0x7ec0ee),
      fogColor: new THREE.Color(0x7ec0ee),
      lightColor: new THREE.Color(0xffffff),
      ambientIntensity: 0.6,
      dirLightIntensity: 1.2,
    },
    {
      time: 0.5, // Sunset
      skyStart: new THREE.Color(0x0e0e20),
      skyEnd: new THREE.Color(0xfb9062),
      fogColor: new THREE.Color(0xfb9062),
      lightColor: new THREE.Color(0xffaa66),
      ambientIntensity: 0.3,
      dirLightIntensity: 0.5,
    },
    {
      time: 0.58, // Night start / twilight ends
      skyStart: new THREE.Color(0x0a0a14),
      skyEnd: new THREE.Color(0x0a0a14),
      fogColor: new THREE.Color(0x0a0a14),
      lightColor: new THREE.Color(0x1a1a2e),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.1,
    },
    {
      time: 0.75, // Midnight
      skyStart: new THREE.Color(0x05050c),
      skyEnd: new THREE.Color(0x05050c),
      fogColor: new THREE.Color(0x05050c),
      lightColor: new THREE.Color(0xaabbff),
      ambientIntensity: 0.1,
      dirLightIntensity: 0.2,
    },
    {
      time: 0.92, // Late night / dawn starts
      skyStart: new THREE.Color(0x0a0a14),
      skyEnd: new THREE.Color(0x0a0a14),
      fogColor: new THREE.Color(0x0a0a14),
      lightColor: new THREE.Color(0x1a1a2e),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.1,
    },
    {
      time: 1.0, // Sunrise (loop)
      skyStart: new THREE.Color(0x0e0e20),
      skyEnd: new THREE.Color(0xfb9062),
      fogColor: new THREE.Color(0xfb9062),
      lightColor: new THREE.Color(0xffaa66),
      ambientIntensity: 0.3,
      dirLightIntensity: 0.5,
    },
  ];

  private getInterpolatedData(timeRatio: number): Omit<Keyframe, 'time'> {
    if (this.lastTimeRatio === timeRatio) {
      return this.cachedData;
    }
    this.lastTimeRatio = timeRatio;
    interpolateKeyframes(timeRatio, this.keyframes, this.cachedData);
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
  private cachedData: Omit<Keyframe, 'time'> = {
    skyStart: new THREE.Color(),
    skyEnd: new THREE.Color(),
    fogColor: new THREE.Color(),
    lightColor: new THREE.Color(),
    ambientIntensity: 0,
    dirLightIntensity: 0,
  };

  private keyframes: Keyframe[] = [
    {
      time: 0.0, // Sunrise
      skyStart: new THREE.Color(0x2a3038),
      skyEnd: new THREE.Color(0x3a424d),
      fogColor: new THREE.Color(0x30363f),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.15,
    },
    {
      time: 0.15, // Morning
      skyStart: new THREE.Color(0x444f5a),
      skyEnd: new THREE.Color(0x5a6978),
      fogColor: new THREE.Color(0x4c5865),
      lightColor: new THREE.Color(0xcccccc),
      ambientIntensity: 0.22,
      dirLightIntensity: 0.3,
    },
    {
      time: 0.25, // Noon
      skyStart: new THREE.Color(0x444f5a),
      skyEnd: new THREE.Color(0x5a6978),
      fogColor: new THREE.Color(0x4c5865),
      lightColor: new THREE.Color(0xcccccc),
      ambientIntensity: 0.25,
      dirLightIntensity: 0.35,
    },
    {
      time: 0.35, // Afternoon
      skyStart: new THREE.Color(0x444f5a),
      skyEnd: new THREE.Color(0x5a6978),
      fogColor: new THREE.Color(0x4c5865),
      lightColor: new THREE.Color(0xcccccc),
      ambientIntensity: 0.22,
      dirLightIntensity: 0.3,
    },
    {
      time: 0.5, // Sunset
      skyStart: new THREE.Color(0x2a3038),
      skyEnd: new THREE.Color(0x3a424d),
      fogColor: new THREE.Color(0x30363f),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.15,
    },
    {
      time: 0.58, // Night start
      skyStart: new THREE.Color(0x0a0c10),
      skyEnd: new THREE.Color(0x101318),
      fogColor: new THREE.Color(0x0c0e12),
      lightColor: new THREE.Color(0x556688),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.05,
    },
    {
      time: 0.75, // Midnight
      skyStart: new THREE.Color(0x050608),
      skyEnd: new THREE.Color(0x080a0d),
      fogColor: new THREE.Color(0x06070a),
      lightColor: new THREE.Color(0x334466),
      ambientIntensity: 0.05,
      dirLightIntensity: 0.02,
    },
    {
      time: 0.92, // Late night
      skyStart: new THREE.Color(0x0a0c10),
      skyEnd: new THREE.Color(0x101318),
      fogColor: new THREE.Color(0x0c0e12),
      lightColor: new THREE.Color(0x556688),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.05,
    },
    {
      time: 1.0, // Sunrise (loop)
      skyStart: new THREE.Color(0x2a3038),
      skyEnd: new THREE.Color(0x3a424d),
      fogColor: new THREE.Color(0x30363f),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.15,
    },
  ];

  private getInterpolatedData(timeRatio: number): Omit<Keyframe, 'time'> {
    if (this.lastTimeRatio === timeRatio) {
      return this.cachedData;
    }
    this.lastTimeRatio = timeRatio;
    interpolateKeyframes(timeRatio, this.keyframes, this.cachedData);
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
  private cachedData: Omit<Keyframe, 'time'> = {
    skyStart: new THREE.Color(),
    skyEnd: new THREE.Color(),
    fogColor: new THREE.Color(),
    lightColor: new THREE.Color(),
    ambientIntensity: 0,
    dirLightIntensity: 0,
  };

  private keyframes: Keyframe[] = [
    {
      time: 0.0, // Sunrise
      skyStart: new THREE.Color(0x121418),
      skyEnd: new THREE.Color(0x1b1d24),
      fogColor: new THREE.Color(0x15171c),
      lightColor: new THREE.Color(0x555555),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.08,
    },
    {
      time: 0.15, // Morning
      skyStart: new THREE.Color(0x22252c),
      skyEnd: new THREE.Color(0x2d323b),
      fogColor: new THREE.Color(0x282b33),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.12,
      dirLightIntensity: 0.12,
    },
    {
      time: 0.25, // Noon
      skyStart: new THREE.Color(0x22252c),
      skyEnd: new THREE.Color(0x2d323b),
      fogColor: new THREE.Color(0x282b33),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.15,
      dirLightIntensity: 0.15,
    },
    {
      time: 0.35, // Afternoon
      skyStart: new THREE.Color(0x22252c),
      skyEnd: new THREE.Color(0x2d323b),
      fogColor: new THREE.Color(0x282b33),
      lightColor: new THREE.Color(0x888888),
      ambientIntensity: 0.12,
      dirLightIntensity: 0.12,
    },
    {
      time: 0.5, // Sunset
      skyStart: new THREE.Color(0x121418),
      skyEnd: new THREE.Color(0x1b1d24),
      fogColor: new THREE.Color(0x15171c),
      lightColor: new THREE.Color(0x555555),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.08,
    },
    {
      time: 0.58, // Night start
      skyStart: new THREE.Color(0x030406),
      skyEnd: new THREE.Color(0x06080b),
      fogColor: new THREE.Color(0x040508),
      lightColor: new THREE.Color(0x334466),
      ambientIntensity: 0.04,
      dirLightIntensity: 0.02,
    },
    {
      time: 0.75, // Midnight
      skyStart: new THREE.Color(0x010203),
      skyEnd: new THREE.Color(0x020304),
      fogColor: new THREE.Color(0x010203),
      lightColor: new THREE.Color(0x112244),
      ambientIntensity: 0.02,
      dirLightIntensity: 0.01,
    },
    {
      time: 0.92, // Late night
      skyStart: new THREE.Color(0x030406),
      skyEnd: new THREE.Color(0x06080b),
      fogColor: new THREE.Color(0x040508),
      lightColor: new THREE.Color(0x334466),
      ambientIntensity: 0.04,
      dirLightIntensity: 0.02,
    },
    {
      time: 1.0, // Sunrise (loop)
      skyStart: new THREE.Color(0x121418),
      skyEnd: new THREE.Color(0x1b1d24),
      fogColor: new THREE.Color(0x15171c),
      lightColor: new THREE.Color(0x555555),
      ambientIntensity: 0.08,
      dirLightIntensity: 0.08,
    },
  ];

  private getInterpolatedData(timeRatio: number): Omit<Keyframe, 'time'> {
    if (this.lastTimeRatio === timeRatio) {
      return this.cachedData;
    }
    this.lastTimeRatio = timeRatio;
    interpolateKeyframes(timeRatio, this.keyframes, this.cachedData);
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
