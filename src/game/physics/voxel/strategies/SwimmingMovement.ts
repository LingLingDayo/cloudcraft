import * as THREE from 'three';
import { getBlockProperties } from '@game/world/World';
import type { IMovementStrategy, MovementContext } from './IMovementStrategy';
import { FluidPhysics } from '../FluidPhysics';

export class SwimmingMovement implements IMovementStrategy {
  public applyForces(context: MovementContext): void {
    const { position, velocity, inputDirection, dt, isJumping, isShiftLeft, state, settings, world, cameraDirection } = context;

    const speed = settings.swimSpeed;
    velocity.x = inputDirection.x * speed;
    velocity.z = inputDirection.z * speed;

    const blockEye = world.getBlock(Math.floor(position.x), Math.floor(position.y + 1.5), Math.floor(position.z));
    const eyeIsLiquid = getBlockProperties(blockEye).isLiquid;

    const wl = FluidPhysics.getWaterLevel(world, position) ?? (Math.floor(position.y) + 1.0);
    const playerHeight = settings.playerSize.height;
    const depth = wl - position.y;
    const immersion = Math.max(0, Math.min(1.0, depth / playerHeight));

    const isMoving = inputDirection.x !== 0 || inputDirection.z !== 0;

    let targetYVel: number;
    let waveAmp = 0;
    let waveFreq = 0;

    let lookSwimY = 0;
    if (cameraDirection && isMoving) {
      const horizontalLook = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
      const moveForwardFactor = inputDirection.dot(horizontalLook);
      lookSwimY = cameraDirection.y * moveForwardFactor * settings.swimSpeed * 0.8;
    }

    if (state.swimTime === undefined) {
      state.swimTime = 0;
    }

    if (isJumping && isShiftLeft) {
      targetYVel = 0;
      state.swimTime = 0;
    } else if (isJumping) {
      state.swimTime += dt;
      if (eyeIsLiquid) {
        targetYVel = 1.5;
      } else {
        const targetFloatY = wl - 0.15;
        const floatDiff = targetFloatY - position.y;
        targetYVel = floatDiff * 1.5;
        waveAmp = 0.45;
        waveFreq = 3.9;
      }
    } else if (isShiftLeft) {
      targetYVel = -1.5;
      state.swimTime = 0;
    } else {
      if (isMoving) {
        state.swimTime += dt;
        if (eyeIsLiquid) {
          targetYVel = 0.5 + lookSwimY;
        } else {
          const targetFloatY = wl - 0.3;
          const floatDiff = targetFloatY - position.y;
          targetYVel = floatDiff * 1.5 + lookSwimY;
          waveAmp = 0.25;
          waveFreq = 7.0;
        }
      } else {
        targetYVel = -0.3;
        state.swimTime = 0;
      }
    }

    let wave = 0;
    if (waveAmp > 0) {
      const rawWave = Math.sin(state.swimTime * waveFreq) * waveAmp;
      const waveFade = Math.max(0, Math.min(1.0, (0.9 - immersion) / 0.1));
      wave = rawWave * waveFade;
    }

    const lerpFactor = 8.0 * dt * Math.max(0.15, immersion);
    velocity.y += (targetYVel + wave - velocity.y) * lerpFactor;
  }
}
