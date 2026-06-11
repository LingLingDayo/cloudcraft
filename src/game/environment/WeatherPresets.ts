import * as THREE from 'three';
import type { IWeather, SkyColors } from './EnvironmentTypes';

// Helper to determine time phase and return blend factor
function getAltitudeInfo(timeRatio: number) {
  const angle = timeRatio * Math.PI * 2;
  const sunAltitude = Math.sin(angle);
  const thresholdHot = 0.1;
  const thresholdCold = -0.1;

  if (sunAltitude > thresholdHot) {
    return { phase: 'day' as const, blend: (sunAltitude - thresholdHot) / (1.0 - thresholdHot), sunAltitude };
  } else if (sunAltitude < thresholdCold) {
    return { phase: 'night' as const, blend: (-sunAltitude + thresholdCold) / (1.0 + thresholdCold), sunAltitude };
  } else {
    return { phase: 'transition' as const, blend: (sunAltitude - thresholdCold) / (thresholdHot - thresholdCold), sunAltitude };
  }
}

export class ClearWeather implements IWeather {
  public id = 'clear';

  public getSkyColors(timeRatio: number): SkyColors {
    const { phase, blend } = getAltitudeInfo(timeRatio);

    let skyStart: THREE.Color;
    let skyEnd: THREE.Color;
    let fogColor: THREE.Color;
    let lightColor: THREE.Color;

    if (phase === 'day') {
      skyStart = new THREE.Color(0xfb9062).lerp(new THREE.Color(0x7ec0ee), blend);
      skyEnd = new THREE.Color(0x7ec0ee);
      fogColor = skyStart.clone();
      lightColor = new THREE.Color(0xffffff);
    } else if (phase === 'night') {
      skyStart = new THREE.Color(0x191932).lerp(new THREE.Color(0x0a0a14), blend);
      skyEnd = new THREE.Color(0x0a0a14);
      fogColor = skyStart.clone();
      lightColor = new THREE.Color(0xaabbff);
    } else {
      skyStart = new THREE.Color(0x0e0e20).lerp(new THREE.Color(0xfb9062), blend);
      skyEnd = skyStart.clone();
      fogColor = skyStart.clone();
      lightColor = new THREE.Color(0xffaa66).lerp(new THREE.Color(0xffffff), blend);
    }

    return { skyStart, skyEnd, fogColor, lightColor };
  }

  public getAmbientIntensity(timeRatio: number): number {
    const { phase, blend } = getAltitudeInfo(timeRatio);
    if (phase === 'day') {
      return 0.5 + blend * 0.2; // 0.5 to 0.7
    } else if (phase === 'night') {
      return 0.15;
    } else {
      return 0.15 + blend * 0.35; // 0.15 to 0.5
    }
  }

  public getDirLightIntensity(timeRatio: number): number {
    const { phase, blend } = getAltitudeInfo(timeRatio);
    if (phase === 'day') {
      return 1.0 + blend * 0.4; // 1.0 to 1.4
    } else if (phase === 'night') {
      return 0.2;
    } else {
      return 0.2 + blend * 0.8; // 0.2 to 1.0
    }
  }

  public getFogDensity(_timeRatio: number): number {
    return 0.015;
  }
}

export class RainWeather implements IWeather {
  public id = 'rain';

  public getSkyColors(timeRatio: number): SkyColors {
    const { phase, blend } = getAltitudeInfo(timeRatio);

    // Rain sky is generally dark grey and overcast
    const rainSkyStart = new THREE.Color(0x444f5a);
    const rainSkyEnd = new THREE.Color(0x5a6978);
    const nightRainStart = new THREE.Color(0x0a0c10);
    const nightRainEnd = new THREE.Color(0x101318);

    let skyStart: THREE.Color;
    let skyEnd: THREE.Color;
    let lightColor: THREE.Color;

    if (phase === 'day') {
      skyStart = rainSkyStart.clone().lerp(rainSkyEnd, blend * 0.3);
      skyEnd = rainSkyEnd;
      lightColor = new THREE.Color(0xcccccc);
    } else if (phase === 'night') {
      skyStart = nightRainStart.clone().lerp(nightRainEnd, blend);
      skyEnd = nightRainEnd;
      lightColor = new THREE.Color(0x556688);
    } else {
      skyStart = nightRainEnd.clone().lerp(rainSkyStart, blend);
      skyEnd = skyStart.clone();
      lightColor = new THREE.Color(0x888888).lerp(new THREE.Color(0xcccccc), blend);
    }

    return {
      skyStart,
      skyEnd,
      fogColor: skyStart.clone(),
      lightColor
    };
  }

  public getAmbientIntensity(timeRatio: number): number {
    const { phase } = getAltitudeInfo(timeRatio);
    return phase === 'night' ? 0.08 : 0.25; // Darker ambient due to clouds
  }

  public getDirLightIntensity(timeRatio: number): number {
    const { phase } = getAltitudeInfo(timeRatio);
    return phase === 'night' ? 0.05 : 0.35; // Sun light is heavily blocked
  }

  public getFogDensity(_timeRatio: number): number {
    return 0.03; // Thicker fog during rain
  }
}

export class StormWeather implements IWeather {
  public id = 'storm';

  public getSkyColors(timeRatio: number): SkyColors {
    const { phase, blend } = getAltitudeInfo(timeRatio);

    // Storm sky is very dark green/greyish black
    const stormSkyStart = new THREE.Color(0x22252c);
    const stormSkyEnd = new THREE.Color(0x2d323b);
    const nightStormStart = new THREE.Color(0x030406);
    const nightStormEnd = new THREE.Color(0x06080b);

    let skyStart: THREE.Color;
    let skyEnd: THREE.Color;
    let lightColor: THREE.Color;

    if (phase === 'day') {
      skyStart = stormSkyStart.clone().lerp(stormSkyEnd, blend * 0.2);
      skyEnd = stormSkyEnd;
      lightColor = new THREE.Color(0x888888);
    } else if (phase === 'night') {
      skyStart = nightStormStart.clone().lerp(nightStormEnd, blend);
      skyEnd = nightStormEnd;
      lightColor = new THREE.Color(0x334466);
    } else {
      skyStart = nightStormEnd.clone().lerp(stormSkyStart, blend);
      skyEnd = skyStart.clone();
      lightColor = new THREE.Color(0x555555).lerp(new THREE.Color(0x888888), blend);
    }

    return {
      skyStart,
      skyEnd,
      fogColor: skyStart.clone(),
      lightColor
    };
  }

  public getAmbientIntensity(timeRatio: number): number {
    const { phase } = getAltitudeInfo(timeRatio);
    return phase === 'night' ? 0.04 : 0.15;
  }

  public getDirLightIntensity(timeRatio: number): number {
    const { phase } = getAltitudeInfo(timeRatio);
    return phase === 'night' ? 0.02 : 0.15;
  }

  public getFogDensity(_timeRatio: number): number {
    return 0.045; // Very dense storm fog
  }
}
