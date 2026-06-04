import * as THREE from 'three';
import { GameManager } from './GameManager';
import { ENVIRONMENT_CONFIG } from './EnvironmentConfig';
import { getBlockProperties } from '@game/world/World';

export class EnvironmentManager {
  private game: GameManager;
  private gameTime: number = ENVIRONMENT_CONFIG.dayNightCycle.startGameTime;
  private dayDuration: number = ENVIRONMENT_CONFIG.dayNightCycle.dayDuration;

  public dirLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;

  constructor(game: GameManager) {
    this.game = game;
    this.initLights();
  }

  private initLights() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.hemiLight.position.set(0, 50, 0);
    this.game.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(20, 40, 20);
    this.dirLight.castShadow = true;
    
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 150;
    const d = 40;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.game.scene.add(this.dirLight);
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
    this.dirLight.position.set(
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
      this.hemiLight.intensity = ENVIRONMENT_CONFIG.lightIntensity.day.hemiIntensityBase + blend * ENVIRONMENT_CONFIG.lightIntensity.day.hemiIntensityScale;
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
      this.hemiLight.intensity = ENVIRONMENT_CONFIG.lightIntensity.night.hemiIntensity;
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
      this.hemiLight.intensity = ENVIRONMENT_CONFIG.lightIntensity.sunriseSunset.hemiIntensityBase + blend * ENVIRONMENT_CONFIG.lightIntensity.sunriseSunset.hemiIntensityScale;
    }

    // Apply lighting and backgrounds
    this.game.renderer.setClearColor(skyColor);
    this.game.scene.background = skyColor;
    if (this.game.scene.fog) {
      (this.game.scene.fog as THREE.FogExp2).color.copy(fogColor);
    }

    this.dirLight.intensity = intensity;
    this.dirLight.color.copy(lightColor);
  }

  private updateUnderwaterEffect() {
    const cameraPos = this.game.camera.position;
    const blockId = this.game.world.getBlock(
      Math.floor(cameraPos.x),
      Math.floor(cameraPos.y),
      Math.floor(cameraPos.z)
    );
    const cameraInWater = getBlockProperties(blockId).isLiquid;

    if (cameraInWater) {
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

  public dispose() {
    if (this.hemiLight) {
      this.game.scene.remove(this.hemiLight);
    }
    if (this.dirLight) {
      this.game.scene.remove(this.dirLight);
    }
  }
}
