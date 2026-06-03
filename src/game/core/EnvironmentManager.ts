import * as THREE from 'three';
import { GameManager } from './GameManager';
import { ENVIRONMENT_CONFIG } from './EnvironmentConfig';

export class EnvironmentManager {
  private game: GameManager;
  private gameTime: number = ENVIRONMENT_CONFIG.dayNightCycle.startGameTime;
  private dayDuration: number = ENVIRONMENT_CONFIG.dayNightCycle.dayDuration;

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
      Math.sin(angle) * ENVIRONMENT_CONFIG.dayNightCycle.sunOrbitRadius,
      Math.cos(angle) * ENVIRONMENT_CONFIG.dayNightCycle.sunOrbitRadius,
      ENVIRONMENT_CONFIG.dayNightCycle.sunOrbitZOffset
    );

    // Calculate light intensities and colors based on time
    const sunAltitude = Math.sin(angle);

    let skyColor: THREE.Color;
    let fogColor: THREE.Color;
    let lightColor: THREE.Color;
    let intensity: number;

    const thresholdHot = ENVIRONMENT_CONFIG.lightIntensity.day.altitudeThreshold;
    const thresholdCold = ENVIRONMENT_CONFIG.lightIntensity.night.altitudeThreshold;

    if (sunAltitude > thresholdHot) {
      // Day
      const blend = (sunAltitude - thresholdHot) / (1.0 - thresholdHot);
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(ENVIRONMENT_CONFIG.colors.daySkyStart),
        new THREE.Color(ENVIRONMENT_CONFIG.colors.daySkyEnd),
        blend
      );
      fogColor = skyColor.clone();
      lightColor = new THREE.Color(ENVIRONMENT_CONFIG.colors.sunriseSunsetLightEnd);
      intensity = ENVIRONMENT_CONFIG.lightIntensity.day.intensityBase + blend * ENVIRONMENT_CONFIG.lightIntensity.day.intensityScale;
      this.game.hemiLight.intensity = ENVIRONMENT_CONFIG.lightIntensity.day.hemiIntensityBase + blend * ENVIRONMENT_CONFIG.lightIntensity.day.hemiIntensityScale;
    } else if (sunAltitude < thresholdCold) {
      // Night
      const blend = (-sunAltitude + thresholdCold) / (1.0 + thresholdCold);
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(ENVIRONMENT_CONFIG.colors.nightSkyStart),
        new THREE.Color(ENVIRONMENT_CONFIG.colors.nightSkyEnd),
        blend
      );
      fogColor = skyColor.clone();
      lightColor = new THREE.Color(ENVIRONMENT_CONFIG.colors.nightLightColor);
      intensity = ENVIRONMENT_CONFIG.lightIntensity.night.intensity;
      this.game.hemiLight.intensity = ENVIRONMENT_CONFIG.lightIntensity.night.hemiIntensity;
    } else {
      // Sunset/Sunrise transition
      const blend = (sunAltitude - thresholdCold) / (thresholdHot - thresholdCold);
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(ENVIRONMENT_CONFIG.colors.dawnDuskStart),
        new THREE.Color(ENVIRONMENT_CONFIG.colors.dawnDuskEnd),
        blend
      );
      fogColor = skyColor.clone();
      lightColor = new THREE.Color().lerpColors(
        new THREE.Color(ENVIRONMENT_CONFIG.colors.sunriseSunsetLightStart),
        new THREE.Color(ENVIRONMENT_CONFIG.colors.sunriseSunsetLightEnd),
        blend
      );
      intensity = ENVIRONMENT_CONFIG.lightIntensity.sunriseSunset.intensityBase + blend * ENVIRONMENT_CONFIG.lightIntensity.sunriseSunset.intensityScale;
      this.game.hemiLight.intensity = ENVIRONMENT_CONFIG.lightIntensity.sunriseSunset.hemiIntensityBase + blend * ENVIRONMENT_CONFIG.lightIntensity.sunriseSunset.hemiIntensityScale;
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
      const waterColor = new THREE.Color(ENVIRONMENT_CONFIG.colors.waterColor);
      this.game.renderer.setClearColor(waterColor);
      this.game.scene.background = waterColor;
      if (this.game.scene.fog && this.game.scene.fog instanceof THREE.FogExp2) {
        this.game.scene.fog.color.copy(waterColor);
        this.game.scene.fog.density = ENVIRONMENT_CONFIG.fog.underwaterDensity;
      }
    } else {
      if (this.game.scene.fog && this.game.scene.fog instanceof THREE.FogExp2) {
        this.game.scene.fog.density = ENVIRONMENT_CONFIG.fog.normalDensity;
      }
    }
  }
}
