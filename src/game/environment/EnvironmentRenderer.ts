import * as THREE from 'three';
import type { BlendedEnvironment } from './EnvironmentTypes';
import type { EnvironmentState } from './EnvironmentState';
import { useGameStore } from '@store/useGameStore';

export class EnvironmentRenderer {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  public hemiLight: THREE.HemisphereLight;

  private waterColor = new THREE.Color(0x1030a0);
  private underwaterDensity = 0.08;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    // Initialize hemisphere light representing sky ambient and ground reflection
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);
  }

  public render(state: EnvironmentState, blended: BlendedEnvironment) {
    const nightFactor = state.getNightFactor();
    const nightBrightness = useGameStore.getState().nightBrightness;
    const nightBoost = nightBrightness > 1.0 ? 1.0 + (nightBrightness - 1.0) * 5.0 : nightBrightness;
    const nightMultiplier = 1.0 + (nightBoost - 1.0) * nightFactor;

    // To prevent distant geometry from glowing or having silhouette mismatches against the sky background,
    // the sky background color must exactly match the fog color.
    let finalSkyColor = blended.skyColors.fogColor;
    let finalFogColor = blended.skyColors.fogColor;
    let finalFogDensity = blended.fogDensity;

    // Post-process medium override (e.g., underwater)
    if (state.cameraInWater) {
      finalSkyColor = this.waterColor;
      finalFogColor = this.waterColor;
      finalFogDensity = this.underwaterDensity;
    } else if (nightMultiplier !== 1.0) {
      // Scale sky and fog colors at night to match ambient lighting
      finalSkyColor = finalSkyColor.clone().multiplyScalar(nightMultiplier);
      finalFogColor = finalFogColor.clone().multiplyScalar(nightMultiplier);
    }

    // Apply background and clear colors
    this.renderer.setClearColor(finalSkyColor);
    this.scene.background = finalSkyColor;

    // Apply fog configuration if present in the scene
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(finalFogColor);
      this.scene.fog.density = finalFogDensity;
    }

    // Apply ambient lighting parameters
    this.hemiLight.color.copy(blended.ambientColor);
    this.hemiLight.intensity = blended.ambientIntensity * nightMultiplier;
  }

  public dispose() {
    this.scene.remove(this.hemiLight);
  }
}
