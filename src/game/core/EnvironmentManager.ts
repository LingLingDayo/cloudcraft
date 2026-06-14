import * as THREE from 'three';
import { GameManager } from './GameManager';
import { EnvironmentState } from '../environment/EnvironmentState';
import { WeatherBlender } from '../environment/WeatherBlender';
import { EnvironmentRenderer } from '../environment/EnvironmentRenderer';
import { SunBody, MoonBody } from '../environment/CelestialBodies';

export class EnvironmentManager {
  private game: GameManager;
  
  // Core Subsystems
  public state: EnvironmentState;
  public blender: WeatherBlender;
  public renderer: EnvironmentRenderer;
  public sun: SunBody;
  public moon: MoonBody;

  // Backward-compatible properties
  public dirLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;

  // Pre-allocated objects to avoid garbage collection pressure in update loop
  private tempSkyLightColor: THREE.Color;
  private torchColor: THREE.Color;

  constructor(game: GameManager) {
    this.game = game;
    this.tempSkyLightColor = new THREE.Color();
    this.torchColor = new THREE.Color(1.0, 0.85, 0.5);

    // 1. Initialize State and Logic
    this.state = new EnvironmentState();
    this.blender = new WeatherBlender();

    // 2. Initialize Renderer
    this.renderer = new EnvironmentRenderer(this.game.scene, this.game.renderer);

    // 3. Initialize Celestial Bodies
    this.sun = new SunBody(this.game.scene);
    this.moon = new MoonBody(this.game.scene);

    // 4. Bind references for backward compatibility
    this.dirLight = this.sun.light;
    this.hemiLight = this.renderer.hemiLight;
  }

  public getGameTime(): number {
    return this.state.gameTime;
  }

  public getDayDuration(): number {
    return this.state.dayDuration;
  }

  /**
   * Sets the active dimension (e.g. overworld, nether, cave)
   */
  public setDimension(dimensionId: string) {
    this.state.setDimension(dimensionId);
  }

  /**
   * Instantly changes the weather
   */
  public setWeather(weatherId: string) {
    this.state.setWeather(weatherId);
  }

  /**
   * Smoothly transitions to a new weather condition
   */
  public transitionToWeather(weatherId: string, speedFactor?: number) {
    this.state.transitionToWeather(weatherId, speedFactor);
  }

  public update(dt: number) {
    // 1. Update overall environmental state (time, camera medium detection)
    this.state.update(
      dt, 
      this.game.camera.position, 
      (x, y, z) => this.game.world.getBlock(x, y, z)
    );

    const timeRatio = this.state.getTimeRatio();

    // 2. Blend active weather configurations
    const blended = this.blender.blend(timeRatio, this.state.weatherWeights);

    // 3. Apply background, clear colors and fog changes to scene
    this.renderer.render(this.state, blended);

    const playerPos = this.game.player.position;

    // 4. Update orbits of Celestial Bodies
    this.sun.update(timeRatio, playerPos);
    this.moon.update(timeRatio, playerPos);

    // 5. Update light colors and intensities based on altitude & blending
    const angle = timeRatio * Math.PI * 2;
    const sunSin = Math.sin(angle);

    // Scale Sun light by its altitude
    const sunWeight = Math.max(0, sunSin);
    this.sun.light.intensity = blended.dirLightIntensity * sunWeight;
    this.sun.light.color.copy(blended.dirLightColor);

    // Scale Moon light by its altitude
    const moonWeight = Math.max(0, -sunSin);
    this.moon.light.intensity = (blended.dirLightIntensity * 0.4) * moonWeight;
    this.moon.light.color.copy(blended.dirLightColor);

    // 6. Update custom voxel shading uniforms
    this.tempSkyLightColor.copy(blended.dirLightColor).multiplyScalar(Math.min(1.0, this.sun.light.intensity / 1.2 + 0.15));
    this.game.world.getRenderer().updateLightingColors(this.tempSkyLightColor, this.torchColor);
  }

  public dispose() {
    this.renderer.dispose();
    this.sun.dispose(this.game.scene);
    this.moon.dispose(this.game.scene);
  }
}
