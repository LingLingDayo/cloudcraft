/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Pig } from './Pig';
import { World } from '@game/world/World';
import { createCoreSpeciesRegistry } from './species/CoreSpecies';

// Mock Canvas 2D context to prevent crash in jsdom environment when generating texture atlas
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
}) as any;

vi.mock('@game/systems/Sound', () => {
  return {
    sound: {
      playPigHurt: vi.fn(),
      playPigDeath: vi.fn(),
      play: vi.fn(),
    },
  };
});

describe('Pig Entity', () => {
  let mockWorld: World;

  const createPig = (id: string, spawnPosition: THREE.Vector3): Pig => {
    return createCoreSpeciesRegistry()
      .get('cloudcraft:pig')
      .create(id, spawnPosition, mockWorld) as Pig;
  };

  beforeEach(() => {
    mockWorld = {
      getBlock: vi.fn(() => 0),
    } as unknown as World;
  });

  test('should initialize Pig properties correctly', () => {
    const spawnPos = new THREE.Vector3(10.5, 4, 10.5);
    const pig = createPig('pig-1', spawnPos);

    expect(pig.id).toBe('pig-1');
    expect(pig.position.x).toBe(10.5);
    expect(pig.position.y).toBe(4);
    expect(pig.position.z).toBe(10.5);
    expect(pig.life).toBe(10);
    expect(pig.maxLife).toBe(10);
    expect(pig.isDead).toBe(false);
    expect(pig.width).toBe(0.9);
    expect(pig.height).toBe(0.9);
    expect(pig.depth).toBe(0.9);
    expect(pig.getMovementModeIds()).toEqual([
      'cloudcraft:swim',
      'cloudcraft:ground',
    ]);
    expect(pig.mesh).toBeDefined();
    expect(pig.mesh.children.length).toBeGreaterThan(0); // Body, Head, Snout, 4 Legs
  });

  test('should take damage and enter panicked state', () => {
    const spawnPos = new THREE.Vector3(10.5, 4, 10.5);
    const pig = createPig('pig-1', spawnPos);

    pig.takeDamage(2);
    expect(pig.life).toBe(8);
    expect(pig.getBehaviorStateId()).toBe('panicked');
    expect(pig.isDead).toBe(false);
  });

  test('should die when health drops to 0', () => {
    const spawnPos = new THREE.Vector3(10.5, 4, 10.5);
    const pig = createPig('pig-1', spawnPos);
    
    // Mock drop items
    pig.dropItems = vi.fn();

    pig.takeDamage(10);
    expect(pig.life).toBe(0);
    expect(pig.isDead).toBe(true);
    expect(pig.dropItems).toHaveBeenCalled();
  });

  test('should serialize and deserialize Pig properties correctly', () => {
    const spawnPos = new THREE.Vector3(10.5, 4, 10.5);
    const pig = createPig('pig-1', spawnPos);
    
    // Set some custom values
    pig.velocity.set(1.0, 2.0, 3.0);
    pig.life = 6;
    pig.isPersistent = true;
    pig.transitionBehavior('panicked');

    const serialized = pig.serialize();
    expect(serialized.id).toBe('pig-1');
    expect(serialized.type).toBe('cloudcraft:pig');
    expect(serialized.x).toBe(10.5);
    expect(serialized.y).toBe(4);
    expect(serialized.z).toBe(10.5);
    expect(serialized.vx).toBe(1.0);
    expect(serialized.vy).toBe(2.0);
    expect(serialized.vz).toBe(3.0);
    expect(serialized.life).toBe(6);
    expect(serialized.isPersistent).toBe(true);
    expect(serialized.customData?.behaviorStateId).toBe('panicked');
    expect(serialized.customData?.movementModeIds).toEqual([
      'cloudcraft:swim',
      'cloudcraft:ground',
    ]);

    // Restore to another pig
    const otherPig = createPig('pig-temp', new THREE.Vector3(0, 0, 0));
    otherPig.deserialize(serialized);

    expect(otherPig.id).toBe('pig-1');
    expect(otherPig.type).toBe('cloudcraft:pig');
    expect(otherPig.position.x).toBe(10.5);
    expect(otherPig.position.y).toBe(4);
    expect(otherPig.position.z).toBe(10.5);
    expect(otherPig.velocity.x).toBe(1.0);
    expect(otherPig.velocity.y).toBe(2.0);
    expect(otherPig.velocity.z).toBe(3.0);
    expect(otherPig.life).toBe(6);
    expect(otherPig.isPersistent).toBe(true);
    expect(otherPig.getBehaviorStateId()).toBe('panicked');
  });

  test('keeps restored panic state across the first post-load updates', () => {
    const pig = createPig('pig-panic', new THREE.Vector3(1, 1, 1));
    pig.takeDamage(1);
    expect(pig.getBehaviorStateId()).toBe('panicked');

    const restored = createPig('pig-other', new THREE.Vector3(0, 0, 0));
    restored.deserialize(pig.serialize());
    expect(restored.getBehaviorStateId()).toBe('panicked');
    expect(restored.serialize().customData?.aiTimer).toBe(5);

    restored.update(0.2);
    expect(restored.getBehaviorStateId()).toBe('panicked');

    // 缺省 aiTimer 的旧快照也应在恢复 panicked 时补满时长
    restored.deserialize({
      ...pig.serialize(),
      customData: {
        behaviorStateId: 'panicked',
        movementModeIds: ['cloudcraft:swim', 'cloudcraft:ground'],
      },
    });
    restored.update(0.1);
    expect(restored.getBehaviorStateId()).toBe('panicked');
  });

  test('accepts legacy customData.aiState during deserialize', () => {
    const pig = createPig('pig-legacy', new THREE.Vector3(0, 1, 0));
    pig.deserialize({
      id: 'pig-legacy',
      type: 'cloudcraft:pig',
      x: 1,
      y: 2,
      z: 3,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 8,
      maxLife: 10,
      isPersistent: true,
      customData: { aiState: 'panicked' },
    });

    expect(pig.getBehaviorStateId()).toBe('panicked');
    pig.update(0.1);
    expect(pig.getBehaviorStateId()).toBe('panicked');
  });
});
