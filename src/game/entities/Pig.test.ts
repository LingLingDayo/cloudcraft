/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Pig } from './Pig';
import { World } from '@game/world/World';

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

  beforeEach(() => {
    mockWorld = {
      getBlock: vi.fn(() => 0),
    } as unknown as World;
  });

  test('should initialize Pig properties correctly', () => {
    const spawnPos = new THREE.Vector3(10.5, 4, 10.5);
    const pig = new Pig('pig-1', spawnPos, mockWorld);

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
    expect(pig.mesh).toBeDefined();
    expect(pig.mesh.children.length).toBeGreaterThan(0); // Body, Head, Snout, 4 Legs
  });

  test('should take damage and enter panicked state', () => {
    const spawnPos = new THREE.Vector3(10.5, 4, 10.5);
    const pig = new Pig('pig-1', spawnPos, mockWorld);

    pig.takeDamage(2);
    expect(pig.life).toBe(8);
    expect(pig.aiState).toBe('panicked');
    expect(pig.isDead).toBe(false);
  });

  test('should die when health drops to 0', () => {
    const spawnPos = new THREE.Vector3(10.5, 4, 10.5);
    const pig = new Pig('pig-1', spawnPos, mockWorld);
    
    // Mock drop items
    pig.dropItems = vi.fn();

    pig.takeDamage(10);
    expect(pig.life).toBe(0);
    expect(pig.isDead).toBe(true);
    expect(pig.dropItems).toHaveBeenCalled();
  });

  test('should serialize and deserialize Pig properties correctly', () => {
    const spawnPos = new THREE.Vector3(10.5, 4, 10.5);
    const pig = new Pig('pig-1', spawnPos, mockWorld);
    
    // Set some custom values
    pig.velocity.set(1.0, 2.0, 3.0);
    pig.life = 6;
    pig.isPersistent = true;
    pig.aiState = 'panicked';

    const serialized = pig.serialize();
    expect(serialized.id).toBe('pig-1');
    expect(serialized.type).toBe('pig');
    expect(serialized.x).toBe(10.5);
    expect(serialized.y).toBe(4);
    expect(serialized.z).toBe(10.5);
    expect(serialized.vx).toBe(1.0);
    expect(serialized.vy).toBe(2.0);
    expect(serialized.vz).toBe(3.0);
    expect(serialized.life).toBe(6);
    expect(serialized.isPersistent).toBe(true);
    expect(serialized.customData?.aiState).toBe('panicked');

    // Restore to another pig
    const otherPig = new Pig('pig-temp', new THREE.Vector3(0, 0, 0), mockWorld);
    otherPig.deserialize(serialized);

    expect(otherPig.id).toBe('pig-1');
    expect(otherPig.type).toBe('pig');
    expect(otherPig.position.x).toBe(10.5);
    expect(otherPig.position.y).toBe(4);
    expect(otherPig.position.z).toBe(10.5);
    expect(otherPig.velocity.x).toBe(1.0);
    expect(otherPig.velocity.y).toBe(2.0);
    expect(otherPig.velocity.z).toBe(3.0);
    expect(otherPig.life).toBe(6);
    expect(otherPig.isPersistent).toBe(true);
    expect(otherPig.aiState).toBe('panicked');
  });
});
