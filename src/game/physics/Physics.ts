import * as THREE from 'three';
import { World } from '@game/world/World';
import { VoxelCollider } from './voxel/VoxelCollider';
import { CharacterController } from './voxel/CharacterController';
import { FluidPhysics } from './voxel/FluidPhysics';
import { RapierPhysicsPlaceholder } from './rigidbody/RapierPhysicsPlaceholder';
import { PHYSICS_CONFIG } from './PhysicsConfig';

/**
 * 物理引擎管理器 (Physics Manager)
 * 
 * 采用 「自研体素物理 + 局部物理引擎辅助」 的混合架构：
 * 1. 自研体素物理：使用 VoxelCollider 处理静态碰撞，CharacterController 处理实体运动逻辑。
 * 2. 局部物理引擎 (RapierPhysics)：处理复杂的刚体仿真、绳索、关节、爆炸碎片等高性能碰撞。
 */
export class Physics {
  private collider: VoxelCollider;
  private characterController: CharacterController;
  private rigidbodyPhysics: RapierPhysicsPlaceholder;
  private world: World;

  // 物理配置参数（公共字段，允许运行时动态修改）
  public playerSize = { ...PHYSICS_CONFIG.playerSize };
  public gravity: number = PHYSICS_CONFIG.gravity;
  public terminalVelocity: number = PHYSICS_CONFIG.terminalVelocity;
  public jumpSpeed: number = PHYSICS_CONFIG.jumpSpeed;
  public walkSpeed: number = PHYSICS_CONFIG.walkSpeed;
  public swimSpeed: number = PHYSICS_CONFIG.swimSpeed;
  public stepHeight: number = PHYSICS_CONFIG.stepHeight;

  constructor(world: World) {
    this.world = world;
    this.collider = new VoxelCollider(world);
    this.characterController = new CharacterController(world, this.collider);
    this.rigidbodyPhysics = new RapierPhysicsPlaceholder(world);
  }

  /**
   * 判断方块是否为实体碰撞方块
   */
  public isSolid(blockId: number): boolean {
    return this.collider.isSolid(blockId);
  }

  /**
   * 获取玩家/实体的 AABB 碰撞盒
   */
  public getPlayerBox(position: THREE.Vector3): THREE.Box3 {
    return VoxelCollider.getBoundingBox(position, this.playerSize);
  }

  /**
   * 检测实体当前是否处于水中/流体中
   */
  public checkInWater(position: THREE.Vector3): boolean {
    return FluidPhysics.checkInWater(this.world, position, false);
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
    state: { onGround: boolean; inWater: boolean; swimTime?: number },
    autoJump: boolean = true,
    cameraDirection?: THREE.Vector3
  ) {
    // 1. 优先更新基于 Voxel 碰撞网格的玩家及核心实体运动
    this.characterController.move(
      position,
      velocity,
      dt,
      inputDirection,
      isJumping,
      isShiftLeft,
      isFlying,
      state,
      this, // passing `this` as settings since it contains walkSpeed, jumpSpeed, etc.
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
    return this.collider.raycast(origin, direction, maxDistance);
  }
}
