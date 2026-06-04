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
});
