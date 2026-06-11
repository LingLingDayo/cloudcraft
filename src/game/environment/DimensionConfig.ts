import * as THREE from 'three';
import type { DimensionConfig } from './EnvironmentTypes';

export const DIMENSIONS: Record<string, DimensionConfig> = {
  overworld: {
    id: 'overworld',
    name: 'Overworld',
    hasDayNightCycle: true,
    baseSkyColors: {
      skyStart: new THREE.Color(0xfb9062),
      skyEnd: new THREE.Color(0x7ec0ee),
      fogColor: new THREE.Color(0x7ec0ee),
      lightColor: new THREE.Color(0xffffff),
    },
    baseAmbientIntensity: 0.5,
    baseDirIntensity: 1.2,
    baseFogDensity: 0.015,
  },
  nether: {
    id: 'nether',
    name: 'Nether',
    hasDayNightCycle: false,
    fixedTime: 0.5,
    baseSkyColors: {
      skyStart: new THREE.Color(0x1a0505),
      skyEnd: new THREE.Color(0x330a0a),
      fogColor: new THREE.Color(0x220707),
      lightColor: new THREE.Color(0xff4422),
    },
    baseAmbientIntensity: 0.4,
    baseDirIntensity: 0.1,
    baseFogDensity: 0.035,
  },
  cave: {
    id: 'cave',
    name: 'Cave',
    hasDayNightCycle: false,
    fixedTime: 0.75,
    baseSkyColors: {
      skyStart: new THREE.Color(0x050508),
      skyEnd: new THREE.Color(0x0a0a0f),
      fogColor: new THREE.Color(0x050508),
      lightColor: new THREE.Color(0x222233),
    },
    baseAmbientIntensity: 0.05,
    baseDirIntensity: 0.0,
    baseFogDensity: 0.06,
  },
};
