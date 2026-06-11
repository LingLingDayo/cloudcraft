import * as THREE from 'three';
import type { BlendedEnvironment } from './EnvironmentTypes';
import type { EnvironmentState } from './EnvironmentState';

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
    let finalSkyColor = blended.skyColors.skyStart;
    let finalFogColor = blended.skyColors.fogColor;
    let finalFogDensity = blended.fogDensity;

    // Post-process medium override (e.g., underwater)
    if (state.cameraInWater) {
      finalSkyColor = this.waterColor;
      finalFogColor = this.waterColor;
      finalFogDensity = this.underwaterDensity;
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
    this.hemiLight.intensity = blended.ambientIntensity;
  }

  public dispose() {
    this.scene.remove(this.hemiLight);
  }
}
