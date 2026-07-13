import type * as THREE from 'three';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/World';
import { createCoreFixtureRegistry } from '@game/fixtures/FixtureDefinitions';
import { WorldFixtureManager } from '@game/fixtures/WorldFixtureManager';
import { ThreeFixtureView } from '@game/fixtures/ThreeFixtureView';

export interface FixtureWorldQuery {
  getBlock(x: number, y: number, z: number): number;
}

export interface GameFixtureRuntime {
  readonly manager: WorldFixtureManager;
  readonly view: ThreeFixtureView;
}

/** Assembles fixture state, occupancy and rendering around one world query. */
export function createGameFixtureRuntime(
  scene: THREE.Scene,
  world: FixtureWorldQuery,
): GameFixtureRuntime {
  const view = new ThreeFixtureView(scene);
  const manager = new WorldFixtureManager(
    createCoreFixtureRegistry(),
    {
      canOccupy: ({ x, y, z }) => {
        const targetBlock = world.getBlock(x, y, z);
        const supportBlock = world.getBlock(x, y - 1, z);
        return targetBlock === BLOCK_TYPES.AIR && getBlockProperties(supportBlock).isSolid;
      },
    },
    view,
  );
  return { manager, view };
}
