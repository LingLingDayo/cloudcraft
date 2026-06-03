import * as THREE from 'three';
import { GameManager } from './GameManager';

export class EnvironmentManager {
  private game: GameManager;
  private gameTime = 60; // Start at 60s (noon)
  private dayDuration = 240; // 4 minutes per day

  constructor(game: GameManager) {
    this.game = game;
  }

  public update(dt: number) {
    this.updateDayNight(dt);
    this.updateUnderwaterEffect();
  }

  private updateDayNight(dt: number) {
    this.gameTime = (this.gameTime + dt) % this.dayDuration;
    const t = this.gameTime / this.dayDuration; // 0 to 1

    // Angle of the sun/moon
    const angle = t * Math.PI * 2;
    
    // Position sun
    this.game.dirLight.position.set(
      Math.sin(angle) * 80,
      Math.cos(angle) * 80,
      15
    );

    // Calculate light intensities and colors based on time
    const sunAltitude = Math.sin(angle);

    let skyColor: THREE.Color;
    let fogColor: THREE.Color;
    let lightColor: THREE.Color;
    let intensity: number;

    if (sunAltitude > 0.1) {
      // Day
      const blend = (sunAltitude - 0.1) / 0.9;
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0xfb9062), new THREE.Color(0x7ec0ee), blend);
      fogColor = skyColor.clone();
      lightColor = new THREE.Color(0xffffff);
      intensity = 1.0 + blend * 0.4;
      this.game.hemiLight.intensity = 0.5 + blend * 0.2;
    } else if (sunAltitude < -0.1) {
      // Night
      const blend = (-sunAltitude - 0.1) / 0.9;
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0x191932), new THREE.Color(0x0a0a14), blend);
      fogColor = skyColor.clone();
      lightColor = new THREE.Color(0xaabbff);
      intensity = 0.2;
      this.game.hemiLight.intensity = 0.15;
    } else {
      // Sunset/Sunrise transition
      const blend = (sunAltitude + 0.1) / 0.2;
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0x0e0e20), new THREE.Color(0xfb9062), blend);
      fogColor = skyColor.clone();
      lightColor = new THREE.Color().lerpColors(new THREE.Color(0xffaa66), new THREE.Color(0xffffff), blend);
      intensity = 0.2 + blend * 0.8;
      this.game.hemiLight.intensity = 0.15 + blend * 0.35;
    }

    // Apply lighting and backgrounds
    this.game.renderer.setClearColor(skyColor);
    this.game.scene.background = skyColor;
    if (this.game.scene.fog) {
      (this.game.scene.fog as THREE.FogExp2).color.copy(fogColor);
    }

    this.game.dirLight.intensity = intensity;
    this.game.dirLight.color.copy(lightColor);
  }

  private updateUnderwaterEffect() {
    if (this.game.player.state.inWater) {
      const waterColor = new THREE.Color(0x1030a0);
      this.game.renderer.setClearColor(waterColor);
      this.game.scene.background = waterColor;
      if (this.game.scene.fog && this.game.scene.fog instanceof THREE.FogExp2) {
        this.game.scene.fog.color.copy(waterColor);
        this.game.scene.fog.density = 0.08;
      }
    } else {
      if (this.game.scene.fog && this.game.scene.fog instanceof THREE.FogExp2) {
        this.game.scene.fog.density = 0.015;
      }
    }
  }
}
