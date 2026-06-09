import * as THREE from 'three';
import { World, getBlockProperties } from '@game/world/World';
import { type Size3D } from '@type';

/**
 * 核心体素碰撞器 (Voxel Collider)
 *
 * 职责：
 * 纯粹的数学与几何碰撞检测（AABB vs Voxel Grid, Raycast）。
 * 不包含任何业务逻辑（如玩家操作、水流、走动、跳跃）。
 */
export class VoxelCollider {
  private world: World;

  constructor(world: World) {
    this.world = world;
  }

  public isSolid(blockId: number): boolean {
    return getBlockProperties(blockId).isSolid;
  }

  public static isCollidable(blockId: number): boolean {
    return getBlockProperties(blockId).isCollidable ?? getBlockProperties(blockId).isSolid;
  }

  public isCollidable(blockId: number): boolean {
    return VoxelCollider.isCollidable(blockId);
  }

  /**
   * 获取实体的 AABB 碰撞盒
   */
  public static getBoundingBox(position: THREE.Vector3, size: Size3D): THREE.Box3 {
    const halfW = size.width / 2;
    const halfD = size.depth / 2;
    return new THREE.Box3(
      new THREE.Vector3(position.x - halfW, position.y, position.z - halfD),
      new THREE.Vector3(position.x + halfW, position.y + size.height, position.z + halfD)
    );
  }

  /**
   * 静态方法：获取与碰撞盒相交的所有可碰撞方块
   */
  public static getCollidingBlocks(world: World, box: THREE.Box3): { x: number; y: number; z: number; id: number }[] {
    const colliders = [];
    const minX = Math.floor(box.min.x);
    const maxX = Math.floor(box.max.x);
    const minY = Math.floor(box.min.y);
    const maxY = Math.floor(box.max.y);
    const minZ = Math.floor(box.min.z);
    const maxZ = Math.floor(box.max.z);

    const eps = 1e-4;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = world.getBlock(x, y, z);
          if (VoxelCollider.isCollidable(id)) {
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

  /**
   * 实例方法：获取与碰撞盒相交的所有可碰撞方块
   */
  public getCollidingBlocks(box: THREE.Box3): { x: number; y: number; z: number; id: number }[] {
    return VoxelCollider.getCollidingBlocks(this.world, box);
  }

  /**
   * 基础静态碰撞解析：针对简单的实体（动物、掉落物等）进行 X/Z/Y 轴的物理防穿透判定。
   */
  public static resolveMove(
    world: World,
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    size: Size3D,
    dt: number
  ): { collidedX: boolean; collidedZ: boolean; onGround: boolean } {
    let collidedX = false;
    let collidedZ = false;
    let onGround = false;

    // 1. X 轴
    position.x += velocity.x * dt;
    let box = VoxelCollider.getBoundingBox(position, size);
    let colliders = VoxelCollider.getCollidingBlocks(world, box);
    for (const block of colliders) {
      const overlapX = Math.min(box.max.x - block.x, block.x + 1 - box.min.x);
      if (overlapX > 0) {
        if (velocity.x > 0) position.x -= overlapX;
        else if (velocity.x < 0) position.x += overlapX;
        velocity.x = 0;
        collidedX = true;
        box = VoxelCollider.getBoundingBox(position, size);
      }
    }

    // 2. Z 轴
    position.z += velocity.z * dt;
    box = VoxelCollider.getBoundingBox(position, size);
    colliders = VoxelCollider.getCollidingBlocks(world, box);
    for (const block of colliders) {
      const overlapZ = Math.min(box.max.z - block.z, block.z + 1 - box.min.z);
      if (overlapZ > 0) {
        if (velocity.z > 0) position.z -= overlapZ;
        else if (velocity.z < 0) position.z += overlapZ;
        velocity.z = 0;
        collidedZ = true;
        box = VoxelCollider.getBoundingBox(position, size);
      }
    }

    // 3. Y 轴
    position.y += velocity.y * dt;
    box = VoxelCollider.getBoundingBox(position, size);
    colliders = VoxelCollider.getCollidingBlocks(world, box);
    for (const block of colliders) {
      const overlapY = Math.min(box.max.y - block.y, block.y + 1 - box.min.y);
      if (overlapY > 0) {
        if (velocity.y > 0) {
          position.y -= overlapY;
          velocity.y = 0;
        } else if (velocity.y < 0) {
          position.y += overlapY;
          velocity.y = 0;
          onGround = true;
        }
        box = VoxelCollider.getBoundingBox(position, size);
      }
    }

    // 防掉出虚空保护
    if (position.y < 0) {
      position.y = 0;
      velocity.y = 0;
      onGround = true;
    }

    return { collidedX, collidedZ, onGround };
  }

  /**
   * 使用高效的 DDA 算法在体素网格中执行射线追踪
   */
  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number
  ): { target: THREE.Vector3; place: THREE.Vector3; face: THREE.Vector3; blockId: number; } | null {
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

    const startBlock = this.world.getBlock(x, y, z);
    if (startBlock !== 0 && this.isSolid(startBlock)) {
      return {
        target: new THREE.Vector3(x, y, z),
        place: new THREE.Vector3(x, y, z),
        face: new THREE.Vector3(0, 1, 0),
        blockId: startBlock
      };
    }

    const maxSteps = 150;
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
