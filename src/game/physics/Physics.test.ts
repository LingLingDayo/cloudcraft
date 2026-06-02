import { describe, test, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Physics } from './Physics';
import { World, BLOCK_TYPES } from '../world/World';

describe('Physics System', () => {
  let mockBlockMap: Map<string, number>;
  let mockWorld: World;
  let physics: Physics;

  beforeEach(() => {
    mockBlockMap = new Map();
    // Construct a lightweight Mock World that behaves like the actual World
    mockWorld = {
      getBlock: (x: number, y: number, z: number) => {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        return mockBlockMap.has(key) ? mockBlockMap.get(key)! : BLOCK_TYPES.AIR;
      },
    } as unknown as World;

    physics = new Physics(mockWorld);
  });

  test('isSolid returns correct values', () => {
    expect(physics.isSolid(BLOCK_TYPES.AIR)).toBe(false);
    expect(physics.isSolid(BLOCK_TYPES.WATER)).toBe(false);
    expect(physics.isSolid(BLOCK_TYPES.STONE)).toBe(true);
    expect(physics.isSolid(BLOCK_TYPES.GRASS)).toBe(true);
  });

  test('getPlayerBox calculates AABB box correctly', () => {
    const pos = new THREE.Vector3(10, 5, 10);
    const box = physics.getPlayerBox(pos);

    // player width = 0.6, height = 1.8, depth = 0.6
    expect(box.min.x).toBeCloseTo(9.7);
    expect(box.max.x).toBeCloseTo(10.3);
    expect(box.min.y).toBe(5);
    expect(box.max.y).toBe(6.8);
    expect(box.min.z).toBeCloseTo(9.7);
    expect(box.max.z).toBeCloseTo(10.3);
  });

  test('checkInWater returns true if feet or eyes are in water', () => {
    const pos = new THREE.Vector3(10.5, 5, 10.5);

    // Case 1: Air
    expect(physics.checkInWater(pos)).toBe(false);

    // Case 2: Water at bottom (feet)
    mockBlockMap.set('10,5,10', BLOCK_TYPES.WATER);
    expect(physics.checkInWater(pos)).toBe(true);

    // Case 3: Water at eyes (y + 1.5)
    mockBlockMap.clear();
    mockBlockMap.set('10,6,10', BLOCK_TYPES.WATER); // 5 + 1.5 = 6.5, Math.floor is 6
    expect(physics.checkInWater(pos)).toBe(true);
  });

  test('gravity pulls player down in air', () => {
    const pos = new THREE.Vector3(10.5, 40, 10.5);
    const vel = new THREE.Vector3(0, 0, 0);
    const state = { onGround: false, inWater: false };

    // Update with delta time = 0.1s, no input, no flight
    physics.update(pos, vel, 0.1, new THREE.Vector3(0, 0, 0), false, false, false, state);

    // gravity is -26, over 0.1s velocity.y should become -2.6
    expect(vel.y).toBeCloseTo(-2.6);
    expect(pos.y).toBeLessThan(40);
    expect(state.onGround).toBe(false);
  });

  test('player lands and stands on solid ground', () => {
    // Put solid block under the player
    // Player feet is at y = 5, standing on block at y = 4 (e.g. coordinates from y=4.0 to y=5.0)
    // If player falls to y = 4.5, it overlaps with block at 4, so should be pushed up to y = 5.
    mockBlockMap.set('10,4,10', BLOCK_TYPES.STONE);

    const pos = new THREE.Vector3(10.5, 4.5, 10.5);
    const vel = new THREE.Vector3(0, -5, 0); // Falling downwards
    const state = { onGround: false, inWater: false };

    physics.update(pos, vel, 0.1, new THREE.Vector3(0, 0, 0), false, false, false, state);

    // Player position should be corrected to y = 5.0 (feet level)
    expect(pos.y).toBeCloseTo(5.0);
    expect(vel.y).toBe(0);
    expect(state.onGround).toBe(true);
  });

  test('horizontal movement and wall collision', () => {
    // 1. Move freely in air (no block)
    const pos = new THREE.Vector3(10.5, 5.0, 10.5);
    const vel = new THREE.Vector3(0, 0, 0);
    const state = { onGround: true, inWater: false };
    const inputDir = new THREE.Vector3(1, 0, 0); // Move +X

    physics.update(pos, vel, 0.1, inputDir, false, false, false, state);
    
    // walkSpeed is 6.0. Over 0.1s with input 1, velocity.x should be 6.0, position.x should move to 10.5 + 0.6 = 11.1
    expect(vel.x).toBe(6.0);
    expect(pos.x).toBeCloseTo(11.1);

    // 2. Add block ahead at x=11, y=5, z=10 (Solid stone wall)
    // Resetting state
    pos.set(10.5, 5.0, 10.5);
    vel.set(0, 0, 0);
    state.onGround = true;
    mockBlockMap.set('11,5,10', BLOCK_TYPES.STONE);

    physics.update(pos, vel, 0.1, inputDir, false, false, false, state);

    // The player should not be able to cross into x=11 because of the solid wall
    // Since player width is 0.6 (half width = 0.3), the max x of player is 11.1.
    // The wall is at x=11 (range 11.0 to 12.0). 11.1 intersects 11.0.
    // Overlap is 11.1 - 11.0 = 0.1. So player is pushed back to 10.5 + 0.6 - 0.1 = 11.0 - 0.3 = 10.7
    expect(pos.x).toBeLessThan(11.0); // Should be pushed back, pos.x should be 10.7
    expect(vel.x).toBe(0); // Collision should reset velocity
  });

  test('jump and move forward against a block does not get stuck in ground', () => {
    for (let x = 8; x <= 22; x++) {
      mockBlockMap.set(`${x},39,8`, BLOCK_TYPES.STONE);
    }
    mockBlockMap.set('9,40,8', BLOCK_TYPES.STONE);

    const pos = new THREE.Vector3(8.5, 40.0, 8.5);
    const vel = new THREE.Vector3(0, 0, 0);
    const state = { onGround: true, inWater: false };
    const inputDir = new THREE.Vector3(1, 0, 0);

    for (let i = 0; i < 40; i++) {
      physics.update(pos, vel, 0.05, inputDir, true, false, false, state);
    }

    expect(pos.y).toBeGreaterThanOrEqual(40.0);
  });
});
