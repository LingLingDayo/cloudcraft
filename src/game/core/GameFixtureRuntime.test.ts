import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { BLOCK_TYPES } from '@game/world/World';
import { createGameFixtureRuntime } from './GameFixtureRuntime';

describe('createGameFixtureRuntime', () => {
  test('assembles a fixture manager with world occupancy and Three view ports', () => {
    const scene = new THREE.Scene();
    const runtime = createGameFixtureRuntime(scene, {
      getBlock: (_x, y) => y === 0 ? BLOCK_TYPES.AIR : BLOCK_TYPES.STONE,
    });

    const result = runtime.manager.place(
      'cloudcraft:chest',
      { x: 2, y: 0, z: 3 },
      0,
    );

    expect(result.ok).toBe(true);
    expect(runtime.manager.createSnapshot().fixtures).toHaveLength(1);
    expect(runtime.view.getRaycastObjects()).toHaveLength(1);

    runtime.manager.dispose();
  });
});
