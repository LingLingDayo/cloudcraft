import * as THREE from 'three';
import { World } from '@game/world/World';
import { VoxelPhysics } from './voxel/VoxelPhysics';
import { RapierPhysicsPlaceholder } from './rigidbody/RapierPhysicsPlaceholder';
import { PHYSICS_CONFIG } from './PhysicsConfig';

/**
 * 物理引擎管理器 (Physics Manager)
 * 
 * 采用 「自研体素物理 + 局部物理引擎辅助」 的混合架构：
 * 1. 自研体素物理 (VoxelPhysics)：处理玩家、常规实体与 3D 方块世界的碰撞，保证原生沙盒游戏的极高帧率与手感。
 * 2. 局部物理引擎 (RapierPhysics)：处理复杂的刚体仿真、绳索、关节、爆炸碎片等高性能碰撞。
 */
export class Physics {
  private voxelPhysics: VoxelPhysics;
  private rigidbodyPhysics: RapierPhysicsPlaceholder;

  // 物理配置参数（公共字段，允许运行时动态修改，VoxelPhysics 引用此处的实时参数）
  public playerSize = { ...PHYSICS_CONFIG.playerSize };
  public gravity: number = PHYSICS_CONFIG.gravity;
  public terminalVelocity: number = PHYSICS_CONFIG.terminalVelocity;
  public jumpSpeed: number = PHYSICS_CONFIG.jumpSpeed;
  public walkSpeed: number = PHYSICS_CONFIG.walkSpeed;
  public swimSpeed: number = PHYSICS_CONFIG.swimSpeed;
  public stepHeight: number = PHYSICS_CONFIG.stepHeight;

  constructor(world: World) {
    // 传入 this 作为 settings 引用，支持动态属性修改的实时更新
    this.voxelPhysics = new VoxelPhysics(world, this);
    this.rigidbodyPhysics = new RapierPhysicsPlaceholder(world);
  }

  /**
   * 判断方块是否为实体碰撞方块
   */
  public isSolid(blockId: number): boolean {
    return this.voxelPhysics.isSolid(blockId);
  }

  /**
   * 获取玩家/实体的 AABB 碰撞盒
   */
  public getPlayerBox(position: THREE.Vector3): THREE.Box3 {
    return this.voxelPhysics.getPlayerBox(position);
  }

  /**
   * 检测实体当前是否处于水中/流体中
   */
  public checkInWater(position: THREE.Vector3): boolean {
    return this.voxelPhysics.checkInWater(position);
  }

  /**
   * 获取 Rapier 辅助物理引擎的句柄 (供后续高级物理功能调用)
   */
  public getRigidbodyPhysics(): RapierPhysicsPlaceholder {
    return this.rigidbodyPhysics;
  }

  /**
   * 物理引擎 Tick 更新
   */
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
    // 1. 优先更新基于 Voxel 碰撞网格的玩家及核心实体运动
    this.voxelPhysics.update(
      position,
      velocity,
      dt,
      inputDirection,
      isJumping,
      isShiftLeft,
      isFlying,
      state,
      autoJump,
      cameraDirection
    );

    // 2. 更新局部物理辅助引擎（处理粒子、爆炸碎屑、投掷物等）
    this.rigidbodyPhysics.update(dt);
  }

  /**
   * 执行高效精确的 DDA 射线检测 (Fast Voxel Traversal)
   */
  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number
  ) {
    return this.voxelPhysics.raycast(origin, direction, maxDistance);
  }
}
