import * as THREE from 'three';

export interface SkyColors {
  skyStart: THREE.Color;
  skyEnd: THREE.Color;
  fogColor: THREE.Color;
  lightColor: THREE.Color;
}

export interface BlendedEnvironment {
  skyColors: SkyColors;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  dirLightIntensity: number;
  dirLightColor: THREE.Color;
  fogDensity: number;
}

export interface ICelestialBody {
  id: string;
  light: THREE.DirectionalLight | THREE.HemisphereLight | null;
  update(timeRatio: number, playerPos: THREE.Vector3): void;
  dispose(scene: THREE.Scene): void;
}

export interface IWeather {
  id: string;
  getSkyColors(timeRatio: number): SkyColors;
  getAmbientIntensity(timeRatio: number): number;
  getDirLightIntensity(timeRatio: number): number;
  getFogDensity(timeRatio: number): number;
}

export interface DimensionConfig {
  id: string;
  name: string;
  hasDayNightCycle: boolean;
  baseSkyColors: SkyColors;
  baseAmbientIntensity: number;
  baseDirIntensity: number;
  baseFogDensity: number;
  fixedTime?: number; // If fixed, time-of-day is static (e.g. Nether)
}
