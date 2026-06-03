export const ENVIRONMENT_CONFIG = {
  dayNightCycle: {
    startGameTime: 60, // Start at 60s (noon)
    dayDuration: 240, // 4 minutes per day
    sunOrbitRadius: 80,
    sunOrbitZOffset: 15,
  },
  lightIntensity: {
    day: {
      altitudeThreshold: 0.1,
      intensityBase: 1.0,
      intensityScale: 0.4,
      hemiIntensityBase: 0.5,
      hemiIntensityScale: 0.2,
    },
    night: {
      altitudeThreshold: -0.1,
      intensity: 0.2,
      hemiIntensity: 0.15,
    },
    sunriseSunset: {
      intensityBase: 0.2,
      intensityScale: 0.8,
      hemiIntensityBase: 0.15,
      hemiIntensityScale: 0.35,
    }
  },
  colors: {
    daySkyStart: 0xfb9062,
    daySkyEnd: 0x7ec0ee,
    nightSkyStart: 0x191932,
    nightSkyEnd: 0x0a0a14,
    dawnDuskStart: 0x0e0e20,
    dawnDuskEnd: 0xfb9062,
    sunriseSunsetLightStart: 0xffaa66,
    sunriseSunsetLightEnd: 0xffffff,
    waterColor: 0x1030a0,
    nightLightColor: 0xaabbff,
  },
  fog: {
    normalDensity: 0.015,
    underwaterDensity: 0.08,
  }
} as const;
