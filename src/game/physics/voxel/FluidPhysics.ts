import * as THREE from 'three';
import { World, getBlockProperties } from '@game/world/World';

/**
 * 流体力学计算 (Fluid Physics)
 *
 * 负责专门处理流体（水、岩浆等）的环境检测、浮力、阻尼等独立逻辑，
 * 将流体业务从纯碰撞检测模块中完全解耦。
 */
export class FluidPhysics {
  /**
   * 检查指定 AABB 是否接触到流体
   * @param world 游戏世界实例
   * @param position 实体坐标
   * @param onGround 实体是否在地面
   * @returns 是否处于流体中
   */
  public static checkInWater(world: World, position: THREE.Vector3, onGround: boolean = false): boolean {
    const blockBottom = world.getBlock(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
    const blockEye = world.getBlock(Math.floor(position.x), Math.floor(position.y + 1.5), Math.floor(position.z));
    
    if (getBlockProperties(blockBottom).isLiquid || getBlockProperties(blockEye).isLiquid) {
      return true;
    }

    // 平滑判定：如果不在地面上，且脚底板下方 0.6 米以内是水，依然判定为在水里，防止水面跳跃/加速抖动
    if (!onGround) {
      const blockBelow = world.getBlock(Math.floor(position.x), Math.floor(position.y - 0.6), Math.floor(position.z));
      if (getBlockProperties(blockBelow).isLiquid) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取当前位置的水面绝对高度
   * @param world 游戏世界实例
   * @param position 实体坐标
   * @returns 水面顶部的 Y 坐标，如果没找到水，返回 null
   */
  public static getWaterLevel(world: World, position: THREE.Vector3): number | null {
    const px = Math.floor(position.x);
    const py = Math.floor(position.y);
    const pz = Math.floor(position.z);
    
    // 头部不在水里，说明水面最高只可能到 py + 1 (即脚部上方一格)
    // 检查范围从 py + 1 向下到 py - 2
    for (let dy = 1; dy >= -2; dy--) {
      const y = py + dy;
      const blockId = world.getBlock(px, y, pz);
      if (getBlockProperties(blockId).isLiquid) {
        return y + 1; // 水面为水方块的顶部
      }
    }
    return null;
  }
}
