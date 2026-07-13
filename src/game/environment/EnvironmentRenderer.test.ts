import { describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { EnvironmentRenderer } from './EnvironmentRenderer';
import { EnvironmentState } from './EnvironmentState';
import type { BlendedEnvironment } from './EnvironmentTypes';

function createBlendedEnvironment(): BlendedEnvironment {
  return {
    skyColors: {
      skyStart: new THREE.Color(0x111111),
      skyEnd: new THREE.Color(0x222222),
      fogColor: new THREE.Color(0x333333),
      lightColor: new THREE.Color(0x444444),
    },
    ambientColor: new THREE.Color(0x555555),
    ambientIntensity: 0.5,
    dirLightIntensity: 0.8,
    dirLightColor: new THREE.Color(0x666666),
    fogDensity: 0.02,
  };
}

describe('EnvironmentRenderer', () => {
  test('reuses its final sky color while applying night brightness', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.01);
    const setClearColor = vi.fn();
    const renderer = { setClearColor } as unknown as THREE.WebGLRenderer;
    const environmentRenderer = new EnvironmentRenderer(scene, renderer);
    const state = new EnvironmentState('test-renderer-seed');
    const blended = createBlendedEnvironment();
    state.gameTime = state.dayDuration * 0.75;

    environmentRenderer.render(state, blended);
    const firstColor = setClearColor.mock.calls[0][0] as THREE.Color;
    environmentRenderer.render(state, blended);
    const secondColor = setClearColor.mock.calls[1][0] as THREE.Color;

    expect(secondColor).toBe(firstColor);
    expect(scene.background).toBe(firstColor);
  });
});
