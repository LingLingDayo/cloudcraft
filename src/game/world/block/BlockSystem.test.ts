/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect } from 'vitest';
import { World } from '../World';
import { BLOCK_TYPES } from '../BlockConfig';

// Bypass slow WebGL mesh updates globally in this test suite
World.prototype.updateChunkMesh = () => {};
import { ItemType } from '@type';
import { BlockRegistry } from './BlockRegistry';
import { ChestBlockEntity } from './BlockEntity';

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

describe('Block Registry and Entity System', () => {
  test('should successfully register and retrieve block properties', () => {
    const grass = BlockRegistry.get(BLOCK_TYPES.GRASS);
    expect(grass).toBeDefined();
    expect(grass.name).toBe('草方块');
    expect(grass.isSolid).toBe(true);
    expect(grass.isInteractable).toBe(false);
    expect(grass.properties.allowVegetationBase).toBe(true);

    const dirt = BlockRegistry.get(BLOCK_TYPES.DIRT);
    expect(dirt).toBeDefined();
    expect(dirt.properties.allowVegetationBase).toBe(true);

    const sand = BlockRegistry.get(BLOCK_TYPES.SAND);
    expect(sand).toBeDefined();
    expect(sand.properties.allowVegetationBase).toBe(true);

    const stone = BlockRegistry.get(BLOCK_TYPES.STONE);
    expect(stone).toBeDefined();
    expect(stone.properties.allowVegetationBase).toBeFalsy();

    const air = BlockRegistry.get(BLOCK_TYPES.AIR);
    expect(air).toBeDefined();
    expect(air.properties.allowVegetationBase).toBeFalsy();

    const chest = BlockRegistry.get(13); // CHEST
    expect(chest).toBeDefined();
    expect(chest.name).toBe('箱子');
    expect(chest.isInteractable).toBe(true);
    expect(chest.hasBlockEntity()).toBe(true);
  });

  test('should create BlockEntity when placing CHEST and remove it when destroyed', () => {
    const world = new World('test-seed');
    
    // Place a chest
    world.setBlock(10, 10, 10, 13); // ID 13 is Chest
    
    // Verify block is placed
    expect(world.getBlock(10, 10, 10)).toBe(13);
    
    // Verify entity is created in BlockEntityManager
    const entity = world.blockEntities.getEntity(10, 10, 10);
    expect(entity).not.toBeNull();
    expect(entity instanceof ChestBlockEntity).toBe(true);
    
    // Add item to chest
    const chestEntity = entity as ChestBlockEntity;
    chestEntity.inventory[0] = { type: ItemType.DIAMOND, count: 64 };
    
    // Destroy chest (set to AIR)
    world.setBlock(10, 10, 10, BLOCK_TYPES.AIR);
    
    // Verify entity is removed
    const entityAfter = world.blockEntities.getEntity(10, 10, 10);
    expect(entityAfter).toBeNull();
  });

  test('should serialize and deserialize world block entities state', () => {
    const world = new World('test-seed');
    world.setBlock(5, 5, 5, 13); // Chest at (5,5,5)
    
    const entity = world.blockEntities.getEntity(5, 5, 5) as ChestBlockEntity;
    expect(entity).not.toBeNull();
    entity.inventory[4] = { type: ItemType.IRON, count: 16 };
    
    // Save world
    const saveStr = world.saveWorld();
    
    // Load into a new world
    const loadedWorld = new World('test-seed');
    loadedWorld.loadWorld(saveStr);
    
    // Verify chest block restoration
    expect(loadedWorld.getBlock(5, 5, 5)).toBe(13);
    
    // Verify chest inventory restoration
    const loadedEntity = loadedWorld.blockEntities.getEntity(5, 5, 5) as ChestBlockEntity;
    expect(loadedEntity).not.toBeNull();
    expect(loadedEntity.inventory[4]).toEqual({ type: ItemType.IRON, count: 16 });
  });

  test('should simulate sand gravity block falling when below block is AIR', () => {
    const world = new World('test-seed');
    
    // Set base support
    world.setBlock(12, 10, 12, BLOCK_TYPES.STONE);
    // Set sand above it
    world.setBlock(12, 11, 12, BLOCK_TYPES.SAND);
    
    // Remove base support (set to AIR)
    world.setBlock(12, 10, 12, BLOCK_TYPES.AIR);
    
    // Trigger tick
    world.update(0.15); // Exceeds timer interval
    
    // Sand should have fallen to y=10
    expect(world.getBlock(12, 11, 12)).toBe(BLOCK_TYPES.AIR);
    expect(world.getBlock(12, 10, 12)).toBe(BLOCK_TYPES.SAND);
  });
});
