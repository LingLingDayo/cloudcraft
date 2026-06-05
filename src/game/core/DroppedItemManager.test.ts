import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { DroppedItemManager } from './DroppedItemManager';
import { ItemType } from '@type';
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
    manager.spawnItem(ItemType.GRASS, pos);

    // Retrieve the spawned item
    const items = (manager as unknown as {
      droppedItems: {
        type: ItemType;
        velocity: THREE.Vector3;
        position: THREE.Vector3;
      }[];
    }).droppedItems;
    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item.type).toBe(ItemType.GRASS);
    
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
    manager.spawnItem(ItemType.STONE, plainPos);

    const items = (manager as unknown as {
      droppedItems: {
        type: ItemType;
        velocity: THREE.Vector3;
        position: THREE.Vector3;
      }[];
    }).droppedItems;
    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item.type).toBe(ItemType.STONE);
    
    expect(item.velocity.x).toBe(0);
    expect(item.velocity.y).toBe(0);
    expect(item.velocity.z).toBe(0);

    expect(item.position.x).toBe(5.5);
    expect(item.position.y).toBe(15.5);
    expect(item.position.z).toBe(25.5);
  });

  test('should spawn cross shape dropped item for saplings', () => {
    const pos = new THREE.Vector3(10.5, 20.5, 30.5);
    manager.spawnItem(ItemType.OAK_SAPLING, pos);

    const items = (manager as unknown as {
      droppedItems: {
        type: ItemType;
        velocity: THREE.Vector3;
        position: THREE.Vector3;
        mesh: THREE.Mesh;
      }[];
    }).droppedItems;
    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item.type).toBe(ItemType.OAK_SAPLING);
    
    // Verify geometry attributes for cross shape (12 vertices)
    const geom = item.mesh.geometry;
    const positionAttr = geom.getAttribute('position');
    expect(positionAttr.count).toBe(12); // 2 planes * 6 vertices per plane
  });
});
