import * as THREE from 'three';
import { World, getBlockProperties } from '@game/world/World';

/**
 * 自研体素物理引擎 (Voxel Physics)
 * 
 * 核心职责:
 * 1. 负责玩家与常规体素方块（AABB vs Grid）的碰撞检测与运动修正。
 * 2. 支持水、空气、普通方块的物理状态判定（浮力、重力、阻力）。
 * 3. 保证沙盒游戏的基础走动、跳跃、飞行的自然手感。
 */
export class VoxelPhysics {
  private world: World;
  private settings: {
    playerSize: { width: number; height: number; depth: number };
    gravity: number;
    terminalVelocity: number;
    jumpSpeed: number;
    walkSpeed: number;
    swimSpeed: number;
    stepHeight: number;
  };

  constructor(
    world: World,
    settings: {
      playerSize: { width: number; height: number; depth: number };
      gravity: number;
      terminalVelocity: number;
      jumpSpeed: number;
      walkSpeed: number;
      swimSpeed: number;
      stepHeight: number;
    }
  ) {
    this.world = world;
    this.settings = settings;
  }

  // A block is solid based on its configured block properties
  public isSolid(blockId: number): boolean {
    return getBlockProperties(blockId).isSolid;
  }

  // Get bounding box of the player
  public getPlayerBox(position: THREE.Vector3): THREE.Box3 {
    const halfW = this.settings.playerSize.width / 2;
    const halfD = this.settings.playerSize.depth / 2;
    return new THREE.Box3(
      new THREE.Vector3(position.x - halfW, position.y, position.z - halfD),
      new THREE.Vector3(position.x + halfW, position.y + this.settings.playerSize.height, position.z + halfD)
    );
  }

  // Get all solid blocks that intersect the bounding box
  private getCollidingBlocks(box: THREE.Box3): { x: number; y: number; z: number; id: number }[] {
    const colliders = [];
    const minX = Math.floor(box.min.x);
    const maxX = Math.floor(box.max.x);
    const minY = Math.floor(box.min.y);
    const maxY = Math.floor(box.max.y);
    const minZ = Math.floor(box.min.z);
    const maxZ = Math.floor(box.max.z);

    const eps = 1e-5;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = this.world.getBlock(x, y, z);
          if (this.isSolid(id)) {
            const isIntersect = (
              box.min.x + eps < x + 1 &&
              box.max.x - eps > x &&
              box.min.y + eps < y + 1 &&
              box.max.y - eps > y &&
              box.min.z + eps < z + 1 &&
              box.max.z - eps > z
            );
            if (isIntersect) {
              colliders.push({ x, y, z, id });
            }
          }
        }
      }
    }
    return colliders;
  }

  // Check if player is in a liquid block (like water)
  public checkInWater(position: THREE.Vector3): boolean {
    const blockBottom = this.world.getBlock(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
    const blockEye = this.world.getBlock(Math.floor(position.x), Math.floor(position.y + 1.5), Math.floor(position.z));
    return getBlockProperties(blockBottom).isLiquid || getBlockProperties(blockEye).isLiquid;
  }

  public update(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    dt: number,
    inputDirection: THREE.Vector3,
    isJumping: boolean,
    isShiftLeft: boolean,
    isFlying: boolean,
    state: { onGround: boolean; inWater: boolean },
    autoJump: boolean = true
  ) {
    // Limit dt to prevent huge physics steps (e.g. during lag spikes)
    dt = Math.min(dt, 0.1);

    // 1. Check if in water
    state.inWater = this.checkInWater(position);

    // 2. Apply movement forces
    if (isFlying) {
      const flySpeed = this.settings.walkSpeed * 2.0;
      velocity.x = inputDirection.x * flySpeed;
      velocity.z = inputDirection.z * flySpeed;

      const verticalMove = (isJumping ? 1 : 0) + (isShiftLeft ? -1 : 0);
      velocity.y = verticalMove * this.settings.walkSpeed * 1.5;

      state.onGround = false;
    } else {
      const speed = state.inWater ? this.settings.swimSpeed : this.settings.walkSpeed;
      velocity.x = inputDirection.x * speed;
      velocity.z = inputDirection.z * speed;

      // 3. Apply gravity & swimming buoyancy
      if (state.inWater) {
        if (isJumping) {
          velocity.y = 3.0; // Swim upwards
        } else {
          // Slow sink in water
          velocity.y = Math.max(-2, velocity.y + this.settings.gravity * 0.15 * dt);
        }
      } else {
        // Normal gravity
        if (!state.onGround) {
          velocity.y += this.settings.gravity * dt;
          velocity.y = Math.max(this.settings.terminalVelocity, velocity.y);
        } else {
          velocity.y = 0;
        }

        // Jump
        if (isJumping && state.onGround) {
          velocity.y = this.settings.jumpSpeed;
          state.onGround = false;
        }
      }
    }

    // 4. Resolve collisions axis by axis
    const oldX = position.x;
    const oldY = position.y;
    const oldZ = position.z;
    const oldVelX = velocity.x;
    const oldVelZ = velocity.z;

    // Move along X (Normal Path)
    position.x += velocity.x * dt;
    let box = this.getPlayerBox(position);
    let colliders = this.getCollidingBlocks(box);
    let collidedX = false;
    for (const block of colliders) {
      const overlapX = Math.min(box.max.x - block.x, block.x + 1 - box.min.x);
      if (overlapX > 0) {
        if (velocity.x > 0) position.x -= overlapX;
        else if (velocity.x < 0) position.x += overlapX;
        velocity.x = 0;
        collidedX = true;
        box = this.getPlayerBox(position);
      }
    }

    // Move along Z (Normal Path)
    position.z += velocity.z * dt;
    box = this.getPlayerBox(position);
    colliders = this.getCollidingBlocks(box);
    let collidedZ = false;
    for (const block of colliders) {
      const overlapZ = Math.min(box.max.z - block.z, block.z + 1 - box.min.z);
      if (overlapZ > 0) {
        if (velocity.z > 0) position.z -= overlapZ;
        else if (velocity.z < 0) position.z += overlapZ;
        velocity.z = 0;
        collidedZ = true;
        box = this.getPlayerBox(position);
      }
    }

    const normalX = position.x;
    const normalZ = position.z;
    const normalY = position.y;

    // Step-up 自动上台阶判定
    const stepHeight = this.settings.stepHeight;
    if (state.onGround && !isFlying && (collidedX || collidedZ)) {
      // 恢复移动前位置
      position.set(oldX, oldY, oldZ);

      // AABB 向上尝试抬升 stepHeight (同时防头顶卡实心方块)
      position.y += stepHeight;
      box = this.getPlayerBox(position);
      colliders = this.getCollidingBlocks(box);
      for (const block of colliders) {
        const overlapY = Math.min(box.max.y - block.y, block.y + 1 - box.min.y);
        if (overlapY > 0) {
          position.y -= overlapY;
          box = this.getPlayerBox(position);
        }
      }
      const actualStepUpY = position.y - oldY;

      let triggerAutoJump = false;

      if (actualStepUpY > 0) {
        // 在升高高度重新应用水平 X 轴和 Z 轴位移
        // 重新进行 X 移动与碰撞检测
        position.x += oldVelX * dt;
        box = this.getPlayerBox(position);
        colliders = this.getCollidingBlocks(box);
        let stepCollidedX = false;
        for (const block of colliders) {
          const overlapX = Math.min(box.max.x - block.x, block.x + 1 - box.min.x);
          if (overlapX > 0) {
            if (oldVelX > 0) position.x -= overlapX;
            else if (oldVelX < 0) position.x += overlapX;
            stepCollidedX = true;
            box = this.getPlayerBox(position);
          }
        }

        // 重新进行 Z 移动与碰撞检测
        position.z += oldVelZ * dt;
        box = this.getPlayerBox(position);
        colliders = this.getCollidingBlocks(box);
        let stepCollidedZ = false;
        for (const block of colliders) {
          const overlapZ = Math.min(box.max.z - block.z, block.z + 1 - box.min.z);
          if (overlapZ > 0) {
            if (oldVelZ > 0) position.z -= overlapZ;
            else if (oldVelZ < 0) position.z += overlapZ;
            stepCollidedZ = true;
            box = this.getPlayerBox(position);
          }
        }

        // 尝试下沉还原抬高的空间，对齐站在台阶表面
        position.y -= actualStepUpY;
        box = this.getPlayerBox(position);
        colliders = this.getCollidingBlocks(box);
        for (const block of colliders) {
          const overlapY = Math.min(box.max.y - block.y, block.y + 1 - box.min.y);
          if (overlapY > 0) {
            position.y += overlapY;
            box = this.getPlayerBox(position);
          }
        }

        // 决策：比较水平移动效率
        const distNormalSq = (normalX - oldX) * (normalX - oldX) + (normalZ - oldZ) * (normalZ - oldZ);
        const distStepSq = (position.x - oldX) * (position.x - oldX) + (position.z - oldZ) * (position.z - oldZ);

        if (distStepSq > distNormalSq) {
          // 采纳上台阶结果
          velocity.x = stepCollidedX ? 0 : oldVelX;
          velocity.z = stepCollidedZ ? 0 : oldVelZ;
          velocity.y = 0; // 重置 Y 轴速度（在地上上台不应该有重力下坠趋势）
        } else {
          // 放弃上台，还原到不上台位置
          position.x = normalX;
          position.z = normalZ;
          position.y = normalY;
          velocity.x = collidedX ? 0 : oldVelX;
          velocity.z = collidedZ ? 0 : oldVelZ;
          triggerAutoJump = true;
        }
      } else {
        // 头顶无抬高空间，还原
        position.x = normalX;
        position.z = normalZ;
        position.y = normalY;
        velocity.x = collidedX ? 0 : oldVelX;
        velocity.z = collidedZ ? 0 : oldVelZ;
        triggerAutoJump = true;
      }

      // 自动跳跃 (Auto Jump)
      if (triggerAutoJump && autoJump && !isShiftLeft) {
        const baseDirY = Math.floor(position.y);
        let shouldAutoJump = false;

        if (collidedX) {
          const dx = Math.sign(oldVelX);
          const checkX = Math.floor(position.x + dx * 0.35);
          const checkZ = Math.floor(position.z);

          const feetSolid = this.isSolid(this.world.getBlock(checkX, baseDirY, checkZ));
          const kneeSolid = this.isSolid(this.world.getBlock(checkX, baseDirY + 1, checkZ));
          const headSolid = this.isSolid(this.world.getBlock(checkX, baseDirY + 2, checkZ));

          if (feetSolid && !kneeSolid && !headSolid) {
            shouldAutoJump = true;
          }
        }

        if (collidedZ && !shouldAutoJump) {
          const dz = Math.sign(oldVelZ);
          const checkX = Math.floor(position.x);
          const checkZ = Math.floor(position.z + dz * 0.35);

          const feetSolid = this.isSolid(this.world.getBlock(checkX, baseDirY, checkZ));
          const kneeSolid = this.isSolid(this.world.getBlock(checkX, baseDirY + 1, checkZ));
          const headSolid = this.isSolid(this.world.getBlock(checkX, baseDirY + 2, checkZ));

          if (feetSolid && !kneeSolid && !headSolid) {
            shouldAutoJump = true;
          }
        }

        if (shouldAutoJump) {
          velocity.y = this.settings.jumpSpeed;
          state.onGround = false;
          velocity.x = oldVelX;
          velocity.z = oldVelZ;
        }
      }
    }

    // Move along Y
    position.y += velocity.y * dt;
    box = this.getPlayerBox(position);
    colliders = this.getCollidingBlocks(box);
    
    state.onGround = false;
    for (const block of colliders) {
      const overlapY = Math.min(box.max.y - block.y, block.y + 1 - box.min.y);
      if (overlapY > 0) {
        if (velocity.y > 0) {
          // Hit ceiling
          position.y -= overlapY;
          velocity.y = 0;
        } else if (velocity.y < 0) {
          // Land on ground
          position.y += overlapY;
          velocity.y = 0;
          state.onGround = true;
        }
        box = this.getPlayerBox(position);
      }
    }

    // Extra ground check (in case player is standing perfectly on edge)
    if (!state.onGround && !state.inWater) {
      const testBox = this.getPlayerBox(position);
      testBox.min.y -= 0.01;
      testBox.max.y = testBox.min.y + 0.02;
      const groundBlocks = this.getCollidingBlocks(testBox);
      if (groundBlocks.length > 0) {
        state.onGround = true;
      }
    }
  }

  /**
   * 使用高效的 DDA (Fast Voxel Traversal) 算法在体素网格中执行射线追踪。
   * 
   * @param origin 射线起点
   * @param direction 射线方向向量 (未归一化或已归一化)
   * @param maxDistance 最大探测距离
   */
  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number
  ): {
    target: THREE.Vector3;
    place: THREE.Vector3;
    face: THREE.Vector3;
    blockId: number;
  } | null {
    const dir = direction.clone().normalize();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x > 0 ? 1 : (dir.x < 0 ? -1 : 0);
    const stepY = dir.y > 0 ? 1 : (dir.y < 0 ? -1 : 0);
    const stepZ = dir.z > 0 ? 1 : (dir.z < 0 ? -1 : 0);

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = dir.x > 0 ? (x + 1 - origin.x) / dir.x : (dir.x < 0 ? (x - origin.x) / dir.x : Infinity);
    let tMaxY = dir.y > 0 ? (y + 1 - origin.y) / dir.y : (dir.y < 0 ? (y - origin.y) / dir.y : Infinity);
    let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) / dir.z : (dir.z < 0 ? (z - origin.z) / dir.z : Infinity);

    let t = 0;
    const face = new THREE.Vector3(0, 0, 0);

    // 首先检查起点本身是否就是实心方块
    const startBlock = this.world.getBlock(x, y, z);
    if (startBlock !== 0 && this.isSolid(startBlock)) {
      return {
        target: new THREE.Vector3(x, y, z),
        place: new THREE.Vector3(x, y, z),
        face: new THREE.Vector3(0, 1, 0),
        blockId: startBlock
      };
    }

    const maxSteps = 150; // 防死循环上限
    let steps = 0;

    while (t < maxDistance && steps < maxSteps) {
      steps++;

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          t = tMaxX;
          tMaxX += tDeltaX;
          face.set(-stepX, 0, 0);
        } else {
          z += stepZ;
          t = tMaxZ;
          tMaxZ += tDeltaZ;
          face.set(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          t = tMaxY;
          tMaxY += tDeltaY;
          face.set(0, -stepY, 0);
        } else {
          z += stepZ;
          t = tMaxZ;
          tMaxZ += tDeltaZ;
          face.set(0, 0, -stepZ);
        }
      }

      if (t > maxDistance) break;

      const blockId = this.world.getBlock(x, y, z);
      if (blockId !== 0 && this.isSolid(blockId)) {
        return {
          target: new THREE.Vector3(x, y, z),
          place: new THREE.Vector3(x, y, z).add(face),
          face,
          blockId
        };
      }
    }

    return null;
  }
}
