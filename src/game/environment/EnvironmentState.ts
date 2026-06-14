import * as THREE from 'three';
import { getBlockProperties } from '@game/world/BlockConfig';
import { DIMENSIONS } from './DimensionConfig';
import type { DimensionConfig } from './EnvironmentTypes';

export class EnvironmentState {
  public gameTime: number = 60; // Start at 60s (noon)
  public dayDuration: number = 240; // 4 minutes per day
  public activeDimension: DimensionConfig = DIMENSIONS.overworld;
  public cameraInWater = false;

  public weatherWeights = new Map<string, number>();
  private targetWeights = new Map<string, number>();
  private transitionSpeed = 0.2; // ~5 seconds transition

  constructor() {
    this.weatherWeights.set('clear', 1.0);
    this.targetWeights.set('clear', 1.0);
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

  public setWeather(weatherId: string) {
    // Instantly switch weather weights
    for (const key of this.weatherWeights.keys()) {
      this.weatherWeights.set(key, 0.0);
      this.targetWeights.set(key, 0.0);
    }
    this.weatherWeights.set(weatherId, 1.0);
    this.targetWeights.set(weatherId, 1.0);
  }

  public transitionToWeather(weatherId: string, speedFactor: number = 0.2) {
    this.transitionSpeed = speedFactor;
    // Set targets: specified weather to 1.0, others to 0.0
    this.targetWeights.set(weatherId, 1.0);
    for (const key of this.weatherWeights.keys()) {
      if (key !== weatherId) {
        this.targetWeights.set(key, 0.0);
      }
    }
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
}
