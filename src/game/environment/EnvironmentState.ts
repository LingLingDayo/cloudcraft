import * as THREE from 'three';
import { getBlockProperties } from '@game/world/BlockConfig';
import { DIMENSIONS } from './DimensionConfig';
import type { DimensionConfig } from './EnvironmentTypes';
import {
  WEATHER_IDS,
  WEATHER_TIMELINE_CONFIG,
  WeatherTimeline,
  type WeatherId,
  type WeatherSnapshot,
} from './WeatherTimeline';

export class EnvironmentState {
  public gameTime: number = 60; // Start at 60s (noon)
  public dayDuration: number = 240; // 4 minutes per day
  public activeDimension: DimensionConfig = DIMENSIONS.overworld;
  public cameraInWater = false;

  public readonly timeline: WeatherTimeline;
  public weatherWeights = new Map<string, number>();
  private targetWeights = new Map<string, number>();
  private transitionSpeed: number = WEATHER_TIMELINE_CONFIG.transitionSpeedPerSecond;
  private activeWeather: WeatherId;

  constructor(seed: string = WEATHER_TIMELINE_CONFIG.defaultSeed) {
    this.timeline = new WeatherTimeline(seed);
    this.activeWeather = this.timeline.getWeather();
    for (const weatherId of WEATHER_IDS) {
      const weight = weatherId === this.activeWeather ? 1 : 0;
      this.weatherWeights.set(weatherId, weight);
      this.targetWeights.set(weatherId, weight);
    }
  }

  public setDimension(dimensionId: string) {
    const config = DIMENSIONS[dimensionId];
    if (config) {
      this.activeDimension = config;
      if (config.fixedTime !== undefined) {
        this.gameTime = config.fixedTime * this.dayDuration;
      }
    }
  }

  public getWeather(): WeatherId {
    return this.timeline.getWeather();
  }

  public setWeather(weatherId: WeatherId) {
    this.timeline.setManualWeather(weatherId);
    this.activeWeather = weatherId;
    this.applyWeatherImmediately(weatherId);
  }

  public transitionToWeather(
    weatherId: WeatherId,
    speedFactor: number = WEATHER_TIMELINE_CONFIG.transitionSpeedPerSecond,
  ) {
    this.timeline.setManualWeather(weatherId);
    this.activeWeather = weatherId;
    this.transitionSpeed = speedFactor;
    this.setTargetWeather(weatherId);
  }

  public resumeAutomaticWeather(
    speedFactor: number = WEATHER_TIMELINE_CONFIG.transitionSpeedPerSecond,
  ): void {
    this.timeline.resumeAutomaticWeather();
    this.activeWeather = this.timeline.getWeather();
    this.transitionSpeed = speedFactor;
    this.setTargetWeather(this.activeWeather);
  }

  public createSnapshot(): WeatherSnapshot {
    return this.timeline.createSnapshot();
  }

  public restoreSnapshot(snapshot: WeatherSnapshot): void {
    this.timeline.restoreSnapshot(snapshot);
    this.activeWeather = this.timeline.getWeather();
    this.applyWeatherImmediately(this.activeWeather);
  }

  public getTimeRatio(): number {
    if (this.activeDimension.fixedTime !== undefined) {
      return this.activeDimension.fixedTime;
    }
    return this.gameTime / this.dayDuration;
  }

  public getNightFactor(): number {
    const timeRatio = this.getTimeRatio();
    if (timeRatio >= 0.15 && timeRatio <= 0.35) {
      return 0.0;
    }
    if (timeRatio > 0.35 && timeRatio < 0.58) {
      return (timeRatio - 0.35) / 0.23;
    }
    if (timeRatio >= 0.58 && timeRatio <= 0.92) {
      return 1.0;
    }
    if (timeRatio > 0.92 && timeRatio <= 1.0) {
      return 1.0 - 0.5 * (timeRatio - 0.92) / 0.08;
    }
    // 0.0 to 0.15
    return 0.5 * (1.0 - timeRatio / 0.15);
  }

  public update(dt: number, cameraPos: THREE.Vector3, getBlockId: (x: number, y: number, z: number) => number) {
    // 1. Update Game Time
    if (this.activeDimension.hasDayNightCycle) {
      this.gameTime = (this.gameTime + dt) % this.dayDuration;
    }

    const timelineWeather = this.timeline.update(dt);
    if (timelineWeather !== this.activeWeather) {
      this.activeWeather = timelineWeather;
      this.transitionSpeed = WEATHER_TIMELINE_CONFIG.transitionSpeedPerSecond;
      this.setTargetWeather(timelineWeather);
    }

    // 2. Smoothly Blend Weather Weights
    for (const [id, target] of this.targetWeights.entries()) {
      const current = this.weatherWeights.get(id) ?? 0;
      if (current !== target) {
        const step = dt * this.transitionSpeed;
        if (current < target) {
          const nextVal = Math.min(target, current + step);
          this.weatherWeights.set(id, nextVal);
        } else {
          const nextVal = Math.max(target, current - step);
          this.weatherWeights.set(id, nextVal);
        }
      }
    }

    // 3. Update Camera Medium
    const px = Math.floor(cameraPos.x);
    const py = Math.floor(cameraPos.y);
    const pz = Math.floor(cameraPos.z);
    const blockId = getBlockId(px, py, pz);
    this.cameraInWater = getBlockProperties(blockId).isLiquid;
  }

  private applyWeatherImmediately(weatherId: WeatherId): void {
    for (const id of WEATHER_IDS) {
      const weight = id === weatherId ? 1 : 0;
      this.weatherWeights.set(id, weight);
      this.targetWeights.set(id, weight);
    }
  }

  private setTargetWeather(weatherId: WeatherId): void {
    for (const id of WEATHER_IDS) {
      this.targetWeights.set(id, id === weatherId ? 1 : 0);
    }
  }
}
