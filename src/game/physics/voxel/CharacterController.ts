import * as THREE from 'three';
import { World, getBlockProperties } from '@game/world/World';
import { VoxelCollider } from './VoxelCollider';
import { FluidPhysics } from './FluidPhysics';
import type { IMovementStrategy, MovementContext } from './strategies/IMovementStrategy';
import { WalkingMovement } from './strategies/WalkingMovement';
import { FlyingMovement } from './strategies/FlyingMovement';
import { SwimmingMovement } from './strategies/SwimmingMovement';

/**
 * 角色物理运动控制器 (Character Controller)
 *
 * 负责组装碰撞器(Collider)与运动策略(Strategies)。
 * 核心处理步骤：
 * 1. 状态判断 (水、飞行)
 * 2. 分发运动策略 (行走、游泳、飞行)，计算速度与受力
 * 3. 使用 Collider 解决 X/Z 轴碰撞
 * 4. 解决自动上台阶(Step-up) 和 自动跳跃(Auto-jump)
 * 5. 使用 Collider 解决 Y 轴碰撞并刷新 OnGround 状态
 */
export class CharacterController {
  private world: World;
  private collider: VoxelCollider;
  
  private walkingStrategy: IMovementStrategy = new WalkingMovement();
  private flyingStrategy: IMovementStrategy = new FlyingMovement();
  private swimmingStrategy: IMovementStrategy = new SwimmingMovement();

  constructor(world: World, collider: VoxelCollider) {
    this.world = world;
    this.collider = collider;
  }

  public move(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    dt: number,
    inputDirection: THREE.Vector3,
    isJumping: boolean,
    isShiftLeft: boolean,
    isFlying: boolean,
    state: { onGround: boolean; inWater: boolean; swimTime?: number },
    settings: MovementContext['settings'],
    autoJump: boolean = true,
    cameraDirection?: THREE.Vector3
  ) {
    dt = Math.min(dt, 0.1);

    // 1. 状态检测
    state.inWater = FluidPhysics.checkInWater(this.world, position, state.onGround);

    // 2. 选择运动策略并应用速度与受力
    const context: MovementContext = {
      position, velocity, inputDirection, dt, isJumping, isShiftLeft, state, settings, world: this.world, cameraDirection
    };

    if (isFlying) {
      this.flyingStrategy.applyForces(context);
    } else if (state.inWater) {
      this.swimmingStrategy.applyForces(context);
    } else {
      this.walkingStrategy.applyForces(context);
    }

    // 3. 碰撞检测与位置解析 (X, Z 轴)
    const oldX = position.x;
    const oldY = position.y;
    const oldZ = position.z;
    const oldVelX = velocity.x;
    const oldVelZ = velocity.z;

    position.x += velocity.x * dt;
    let box = VoxelCollider.getBoundingBox(position, settings.playerSize);
    let colliders = this.collider.getCollidingBlocks(box);
    let collidedX = false;
    for (const block of colliders) {
      const overlapX = Math.min(box.max.x - block.box.min.x, block.box.max.x - box.min.x);
      if (overlapX > 0) {
        if (velocity.x > 0) position.x -= overlapX;
        else if (velocity.x < 0) position.x += overlapX;
        velocity.x = 0;
        collidedX = true;
        box = VoxelCollider.getBoundingBox(position, settings.playerSize);
      }
    }

    position.z += velocity.z * dt;
    box = VoxelCollider.getBoundingBox(position, settings.playerSize);
    colliders = this.collider.getCollidingBlocks(box);
    let collidedZ = false;
    for (const block of colliders) {
      const overlapZ = Math.min(box.max.z - block.box.min.z, block.box.max.z - box.min.z);
      if (overlapZ > 0) {
        if (velocity.z > 0) position.z -= overlapZ;
        else if (velocity.z < 0) position.z += overlapZ;
        velocity.z = 0;
        collidedZ = true;
        box = VoxelCollider.getBoundingBox(position, settings.playerSize);
      }
    }

    const normalX = position.x;
    const normalZ = position.z;
    const normalY = position.y;

    // 4. 自动上台阶与自动跳跃判定
    const stepHeight = settings.stepHeight;
    if ((state.onGround || state.inWater) && !isFlying && (collidedX || collidedZ)) {
      position.set(oldX, oldY, oldZ);

      position.y += stepHeight;
      box = VoxelCollider.getBoundingBox(position, settings.playerSize);
      colliders = this.collider.getCollidingBlocks(box);
      for (const block of colliders) {
        const overlapY = Math.min(box.max.y - block.box.min.y, block.box.max.y - box.min.y);
        if (overlapY > 0) {
          position.y -= overlapY;
          box = VoxelCollider.getBoundingBox(position, settings.playerSize);
        }
      }
      const actualStepUpY = position.y - oldY;

      let triggerAutoJump = false;

      if (actualStepUpY > 0) {
        position.x += oldVelX * dt;
        box = VoxelCollider.getBoundingBox(position, settings.playerSize);
        colliders = this.collider.getCollidingBlocks(box);
        let stepCollidedX = false;
        for (const block of colliders) {
          const overlapX = Math.min(box.max.x - block.box.min.x, block.box.max.x - box.min.x);
          if (overlapX > 0) {
            if (oldVelX > 0) position.x -= overlapX;
            else if (oldVelX < 0) position.x += overlapX;
            stepCollidedX = true;
            box = VoxelCollider.getBoundingBox(position, settings.playerSize);
          }
        }

        position.z += oldVelZ * dt;
        box = VoxelCollider.getBoundingBox(position, settings.playerSize);
        colliders = this.collider.getCollidingBlocks(box);
        let stepCollidedZ = false;
        for (const block of colliders) {
          const overlapZ = Math.min(box.max.z - block.box.min.z, block.box.max.z - box.min.z);
          if (overlapZ > 0) {
            if (oldVelZ > 0) position.z -= overlapZ;
            else if (oldVelZ < 0) position.z += overlapZ;
            stepCollidedZ = true;
            box = VoxelCollider.getBoundingBox(position, settings.playerSize);
          }
        }

        position.y -= actualStepUpY;
        box = VoxelCollider.getBoundingBox(position, settings.playerSize);
        colliders = this.collider.getCollidingBlocks(box);
        for (const block of colliders) {
          const overlapY = Math.min(box.max.y - block.box.min.y, block.box.max.y - box.min.y);
          if (overlapY > 0) {
            position.y += overlapY;
            box = VoxelCollider.getBoundingBox(position, settings.playerSize);
          }
        }

        const distNormalSq = (normalX - oldX) * (normalX - oldX) + (normalZ - oldZ) * (normalZ - oldZ);
        const distStepSq = (position.x - oldX) * (position.x - oldX) + (position.z - oldZ) * (position.z - oldZ);

        if (distStepSq > distNormalSq) {
          velocity.x = stepCollidedX ? 0 : oldVelX;
          velocity.z = stepCollidedZ ? 0 : oldVelZ;
          velocity.y = 0;
        } else {
          position.set(normalX, normalY, normalZ);
          velocity.x = collidedX ? 0 : oldVelX;
          velocity.z = collidedZ ? 0 : oldVelZ;
          triggerAutoJump = true;
        }
      } else {
        position.set(normalX, normalY, normalZ);
        velocity.x = collidedX ? 0 : oldVelX;
        velocity.z = collidedZ ? 0 : oldVelZ;
        triggerAutoJump = true;
      }

      // Auto Jump
      if (triggerAutoJump && autoJump) {
        const blockEye = this.world.getBlock(Math.floor(position.x), Math.floor(position.y + 1.5), Math.floor(position.z));
        const eyeIsLiquid = getBlockProperties(blockEye).isLiquid;
        const canAutoJumpInWater = !eyeIsLiquid || state.onGround;

        if (!state.inWater || canAutoJumpInWater) {
          const baseDirY = Math.floor(position.y);
          let shouldAutoJump = false;

          if (collidedX) {
            const dx = Math.sign(oldVelX);
            const checkX = Math.floor(position.x + dx * 0.35);
            const checkZ = Math.floor(position.z);
            if (
              this.collider.isCollidable(this.world.getBlock(checkX, baseDirY, checkZ)) &&
              !this.collider.isCollidable(this.world.getBlock(checkX, baseDirY + 1, checkZ)) &&
              !this.collider.isCollidable(this.world.getBlock(checkX, baseDirY + 2, checkZ))
            ) {
              shouldAutoJump = true;
            }
          }

          if (collidedZ && !shouldAutoJump) {
            const dz = Math.sign(oldVelZ);
            const checkX = Math.floor(position.x);
            const checkZ = Math.floor(position.z + dz * 0.35);
            if (
              this.collider.isCollidable(this.world.getBlock(checkX, baseDirY, checkZ)) &&
              !this.collider.isCollidable(this.world.getBlock(checkX, baseDirY + 1, checkZ)) &&
              !this.collider.isCollidable(this.world.getBlock(checkX, baseDirY + 2, checkZ))
            ) {
              shouldAutoJump = true;
            }
          }

          if (shouldAutoJump) {
            velocity.y = state.inWater ? 3.5 : settings.jumpSpeed;
            state.onGround = false;
            velocity.x = oldVelX;
            velocity.z = oldVelZ;
          }
        }
      }
    }

    // 5. Y 轴的碰撞检测与解析
    position.y += velocity.y * dt;
    box = VoxelCollider.getBoundingBox(position, settings.playerSize);
    colliders = this.collider.getCollidingBlocks(box);
    
    state.onGround = false;
    for (const block of colliders) {
      const overlapY = Math.min(box.max.y - block.box.min.y, block.box.max.y - box.min.y);
      if (overlapY > 0) {
        if (velocity.y > 0) {
          position.y -= overlapY;
          velocity.y = 0;
        } else if (velocity.y < 0) {
          position.y += overlapY;
          velocity.y = 0;
          state.onGround = true;
        }
        box = VoxelCollider.getBoundingBox(position, settings.playerSize);
      }
    }

    if (!state.onGround && !state.inWater) {
      const testBox = VoxelCollider.getBoundingBox(position, settings.playerSize);
      testBox.min.y -= 0.01;
      testBox.max.y = testBox.min.y + 0.02;
      const groundBlocks = this.collider.getCollidingBlocks(testBox);
      if (groundBlocks.length > 0) {
        state.onGround = true;
      }
    }
  }
}
