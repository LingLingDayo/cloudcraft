import * as THREE from 'three';
import { World } from '@game/world/World';
import { type Size3D } from '@type';

export interface MovementContext {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  inputDirection: THREE.Vector3;
  dt: number;
  isJumping: boolean;
  isShiftLeft: boolean;
  state: { onGround: boolean; inWater: boolean; swimTime?: number };
  settings: {
    playerSize: Size3D;
    gravity: number;
    terminalVelocity: number;
    jumpSpeed: number;
    walkSpeed: number;
    swimSpeed: number;
    stepHeight: number;
  };
  world: World;
  cameraDirection?: THREE.Vector3;
}

/**
 * 运动策略接口 (Movement Strategy)
 *
 * 负责在不同的状态下（行走、飞行、游泳等）对实体施加速度与受力，
 * 不负责进行 AABB 碰撞检测与位置解析（由 CharacterController 和 VoxelCollider 完成）。
 */
export interface IMovementStrategy {
  applyForces(context: MovementContext): void;
}
