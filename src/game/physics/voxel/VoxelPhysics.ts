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
  private swimTime = 0;

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

  public isCollidable(blockId: number): boolean {
    return getBlockProperties(blockId).isCollidable ?? getBlockProperties(blockId).isSolid;
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
          if (this.isCollidable(id)) {
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
  public checkInWater(position: THREE.Vector3, onGround: boolean = false): boolean {
    const blockBottom = this.world.getBlock(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
    const blockEye = this.world.getBlock(Math.floor(position.x), Math.floor(position.y + 1.5), Math.floor(position.z));
    
    if (getBlockProperties(blockBottom).isLiquid || getBlockProperties(blockEye).isLiquid) {
      return true;
    }

    // 平滑判定：如果不在地面上，且脚底板下方 0.6 米以内是水，依然判定为在水里，防止水面跳跃/加速抖动
    if (!onGround) {
      const blockBelow = this.world.getBlock(Math.floor(position.x), Math.floor(position.y - 0.6), Math.floor(position.z));
      if (getBlockProperties(blockBelow).isLiquid) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取当前位置的水面绝对高度
   * @param position 玩家位置
   * @returns 水面顶部的 Y 坐标，如果没找到水，返回 null
   */
  private getWaterLevel(position: THREE.Vector3): number | null {
    const px = Math.floor(position.x);
    const py = Math.floor(position.y);
    const pz = Math.floor(position.z);
    
    // 头部不在水里，说明水面最高只可能到 py + 1 (即脚部上方一格)
    // 检查范围从 py + 1 向下到 py - 2
    for (let dy = 1; dy >= -2; dy--) {
      const y = py + dy;
      const blockId = this.world.getBlock(px, y, pz);
      if (getBlockProperties(blockId).isLiquid) {
        return y + 1; // 水面为水方块的顶部
      }
    }
    return null;
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
    autoJump: boolean = true,
    cameraDirection?: THREE.Vector3
  ) {
    // Limit dt to prevent huge physics steps (e.g. during lag spikes)
    dt = Math.min(dt, 0.1);

    // 1. Check if in water
    state.inWater = this.checkInWater(position, state.onGround);

    // 2. Apply movement forces
    if (isFlying) {
      const flySpeedMultiplier = isShiftLeft ? 1.5 : 1.0;
      const flySpeed = this.settings.walkSpeed * 2.0 * flySpeedMultiplier;
      velocity.x = inputDirection.x * flySpeed;
      velocity.z = inputDirection.z * flySpeed;

      const verticalMove = (isJumping ? 1 : 0) + (isShiftLeft ? -1 : 0);
      velocity.y = verticalMove * this.settings.walkSpeed * 1.5 * flySpeedMultiplier;

      state.onGround = false;
    } else {
      // 在水里或脚底下方 1.0 米内有水时，按住 shift (下潜/踏水) 不要加速
      const hasWaterBelow = getBlockProperties(this.world.getBlock(Math.floor(position.x), Math.floor(position.y - 1.0), Math.floor(position.z))).isLiquid;
      const speedMultiplier = (isShiftLeft && !state.inWater && !hasWaterBelow) ? 1.5 : 1.0;
      const speed = (state.inWater ? this.settings.swimSpeed : this.settings.walkSpeed) * speedMultiplier;
      velocity.x = inputDirection.x * speed;
      velocity.z = inputDirection.z * speed;

      // 3. Apply gravity & swimming buoyancy
      if (state.inWater) {
        const blockEye = this.world.getBlock(Math.floor(position.x), Math.floor(position.y + 1.5), Math.floor(position.z));
        const eyeIsLiquid = getBlockProperties(blockEye).isLiquid;

        // 获取稳定的真实水面高度
        const wl = this.getWaterLevel(position) ?? (Math.floor(position.y) + 1.0);
        // 计算浸入比率 immersion [0.0, 1.0] (玩家身高 1.8)
        const playerHeight = this.settings.playerSize.height;
        const depth = wl - position.y;
        const immersion = Math.max(0, Math.min(1.0, depth / playerHeight));

        const isMoving = inputDirection.x !== 0 || inputDirection.z !== 0;

        let targetYVel: number;
        let waveAmp = 0;
        let waveFreq = 0;

        // 计算视线方向对游泳垂直速度的贡献
        let lookSwimY = 0;
        if (cameraDirection && isMoving) {
          const horizontalLook = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
          const moveForwardFactor = inputDirection.dot(horizontalLook);
          lookSwimY = cameraDirection.y * moveForwardFactor * this.settings.swimSpeed * 0.8;
        }

        // 核心物理受力决策
        if (isJumping && isShiftLeft) {
          // 同时按空格和 Shift：保持悬浮
          targetYVel = 0;
          this.swimTime = 0;
        } else if (isJumping) {
          // 按住空格向上游
          this.swimTime += dt;
          if (eyeIsLiquid) {
            // 深水区：平稳向上游
            targetYVel = 1.5;
          } else {
            // 水面起伏区：目标高度在水面上方，形成起伏
            const targetFloatY = wl - 0.15; // 调低目标高度，使其更沉入水中
            const floatDiff = targetFloatY - position.y;
            targetYVel = floatDiff * 1.5;
            waveAmp = 0.45; // 调小起伏幅度
            waveFreq = 3.9;
          }
        } else if (isShiftLeft) {
          // 按住 Shift 向下潜
          targetYVel = -1.5;
          this.swimTime = 0;
        } else {
          // 既不按空格也不按 Shift
          if (isMoving) {
            this.swimTime += dt;
            if (eyeIsLiquid) {
              // 深水游动：缓慢浮起并受朝向影响
              targetYVel = 0.5 + lookSwimY;
            } else {
              // 水面游动：稳定在水面下方一点并受朝向影响
              const targetFloatY = wl - 0.3; // 调低目标高度，使其更沉入水中
              const floatDiff = targetFloatY - position.y;
              targetYVel = floatDiff * 1.5 + lookSwimY;
              waveAmp = 0.25; // 调小移动时起伏幅度
              waveFreq = 7.0;
            }
          } else {
            // 静止无操作：没有浮力，缓慢下沉
            targetYVel = -0.3;
            this.swimTime = 0;
          }
        }

        // 计算物理波浪，并在深水区平滑淡出以防突变
        let wave = 0;
        if (waveAmp > 0) {
          const rawWave = Math.sin(this.swimTime * waveFreq) * waveAmp;
          const waveFade = Math.max(0, Math.min(1.0, (0.9 - immersion) / 0.1));
          wave = rawWave * waveFade;
        }

        // 一阶阻尼平滑更新速度，彻底消除物理跃变抖动
        // 将阻尼系数与浸入比率挂钩，当玩家上浮或跳出水面时，水的束缚（阻尼）显著下降，保证能轻松跳上陆地
        const lerpFactor = 8.0 * dt * Math.max(0.15, immersion);
        velocity.y += (targetYVel + wave - velocity.y) * lerpFactor;
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
    // 允许在水中触发 Step-up 以走上岸
    if ((state.onGround || state.inWater) && !isFlying && (collidedX || collidedZ)) {
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
      if (triggerAutoJump && autoJump) {
        // 在水中时，如果完全浸没在水里，不应该触发自动跳跃，只有在水面（头在空气中）或踩在地上时才自动跳跃
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

            const feetSolid = this.isCollidable(this.world.getBlock(checkX, baseDirY, checkZ));
            const kneeSolid = this.isCollidable(this.world.getBlock(checkX, baseDirY + 1, checkZ));
            const headSolid = this.isCollidable(this.world.getBlock(checkX, baseDirY + 2, checkZ));

            if (feetSolid && !kneeSolid && !headSolid) {
              shouldAutoJump = true;
            }
          }

          if (collidedZ && !shouldAutoJump) {
            const dz = Math.sign(oldVelZ);
            const checkX = Math.floor(position.x);
            const checkZ = Math.floor(position.z + dz * 0.35);

            const feetSolid = this.isCollidable(this.world.getBlock(checkX, baseDirY, checkZ));
            const kneeSolid = this.isCollidable(this.world.getBlock(checkX, baseDirY + 1, checkZ));
            const headSolid = this.isCollidable(this.world.getBlock(checkX, baseDirY + 2, checkZ));

            if (feetSolid && !kneeSolid && !headSolid) {
              shouldAutoJump = true;
            }
          }

          if (shouldAutoJump) {
            velocity.y = state.inWater ? 3.5 : this.settings.jumpSpeed; // 水中跳跃速度稍微柔和一些，防止直接飞出
            state.onGround = false;
            velocity.x = oldVelX;
            velocity.z = oldVelZ;
          }
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
