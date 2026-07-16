import type * as THREE from 'three';
import type { World } from '@game/world/World';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';

const DEFAULT_EYE_HEIGHT = 0.9;
const DEFAULT_STEP = 0.35;

/**
 * 体素视线：沿线段步进采样，仅被不透明可碰撞实心方块遮挡。
 * 树叶、花草等透明/非碰撞体不阻断感知，避免捕猎 AI 在灌木中失明。
 */
export function hasBlockLineOfSight(
  world: World,
  from: THREE.Vector3,
  to: THREE.Vector3,
  options?: {
    readonly eyeHeight?: number;
    readonly step?: number;
  },
): boolean {
  const eyeHeight = options?.eyeHeight ?? DEFAULT_EYE_HEIGHT;
  const step = options?.step ?? DEFAULT_STEP;
  const startX = from.x;
  const startY = from.y + eyeHeight;
  const startZ = from.z;
  const endX = to.x;
  const endY = to.y + eyeHeight;
  const endZ = to.z;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const deltaZ = endZ - startZ;
  const distance = Math.hypot(deltaX, deltaY, deltaZ);
  if (distance < 1e-6) return true;

  const steps = Math.max(1, Math.ceil(distance / step));
  for (let index = 1; index < steps; index++) {
    const t = index / steps;
    const blockId = world.getBlock(
      Math.floor(startX + deltaX * t),
      Math.floor(startY + deltaY * t),
      Math.floor(startZ + deltaZ * t),
    );
    if (blockId === BLOCK_TYPES.AIR) continue;
    const props = getBlockProperties(blockId);
    if (props.isLiquid || props.isTransparent) continue;
    if (props.isCollidable === false) continue;
    return false;
  }
  return true;
}
