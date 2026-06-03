import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { DroppedItemManager } from './DroppedItemManager';
import { BLOCK_TYPES } from '@game/world/BlockConfig';
import type { GameManager } from './GameManager';

describe('DroppedItemManager', () => {
  let mockGame: GameManager;
  let manager: DroppedItemManager;

  beforeEach(() => {
    mockGame = {
      scene: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      world: {
        materials: {
          solid: new THREE.MeshBasicMaterial(),
          transparent: new THREE.MeshBasicMaterial(),
        },
      },
    } as unknown as GameManager;

    manager = new DroppedItemManager(mockGame);
  });

  test('should spawn dropped item with zero initial velocity', () => {
    const pos = new THREE.Vector3(10.5, 20.5, 30.5);
    manager.spawnItem(BLOCK_TYPES.GRASS, pos);

    // Retrieve the spawned item
    const items = (manager as unknown as {
      droppedItems: {
        type: number;
        velocity: THREE.Vector3;
        position: THREE.Vector3;
      }[];
    }).droppedItems;
    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item.type).toBe(BLOCK_TYPES.GRASS);
    
    // Initial velocity should be exactly zero
    expect(item.velocity.x).toBe(0);
    expect(item.velocity.y).toBe(0);
    expect(item.velocity.z).toBe(0);

    // Initial position should be at spawn pos
    expect(item.position.x).toBe(10.5);
    expect(item.position.y).toBe(20.5);
    expect(item.position.z).toBe(30.5);
  });

  test('should support plain position objects', () => {
    const plainPos = { x: 5.5, y: 15.5, z: 25.5 };
    manager.spawnItem(BLOCK_TYPES.STONE, plainPos);

    const items = (manager as unknown as {
      droppedItems: {
        type: number;
        velocity: THREE.Vector3;
        position: THREE.Vector3;
      }[];
    }).droppedItems;
    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item.type).toBe(BLOCK_TYPES.STONE);
    
    expect(item.velocity.x).toBe(0);
    expect(item.velocity.y).toBe(0);
    expect(item.velocity.z).toBe(0);

    expect(item.position.x).toBe(5.5);
    expect(item.position.y).toBe(15.5);
    expect(item.position.z).toBe(25.5);
  });
});
