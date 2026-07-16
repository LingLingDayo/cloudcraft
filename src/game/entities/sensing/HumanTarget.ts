import * as THREE from 'three';
import type { World } from '@game/world/World';

/** 可被敌对生物锁定的人类目标契约（通常为玩家）。 */
export interface HumanTarget {
  readonly position: THREE.Vector3;
  takeDamage(amount: number, world: World, physics: unknown): void;
}

export function resolveHumanTarget(world: World): HumanTarget | null {
  const player = world.game?.player as Partial<HumanTarget> | undefined;
  return player?.position instanceof THREE.Vector3 && typeof player.takeDamage === 'function'
    ? player as HumanTarget
    : null;
}
