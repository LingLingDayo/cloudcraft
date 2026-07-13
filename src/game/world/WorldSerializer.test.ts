import { describe, expect, test, vi } from 'vitest';
import { World, WORLD_HEIGHT } from './World';
import { BLOCK_TYPES } from './BlockConfig';
import { DynamicMaterialRegistry } from '@game/dynamics/DynamicMaterialRegistry';
import { EMPTY_DYNAMIC_MATERIAL_SNAPSHOT } from '@game/dynamics/DynamicMaterialSnapshot';

World.prototype.updateChunkMesh = () => {};

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
}) as never;

describe('World Serialization by Modified Blocks Tracking', () => {
  test('uses an injected dynamic material registry in the production world', () => {
    const registry = new DynamicMaterialRegistry();
    registry.register({
      id: 'test:dirt_fall',
      blockIds: [BLOCK_TYPES.DIRT],
      replaceableBlockIds: [BLOCK_TYPES.AIR],
      gravity: -24,
      terminalVelocity: -35,
    });
    registry.freeze();
    const world = new World('test-dynamic-registry', undefined, registry);
    world.setBlock(1, WORLD_HEIGHT - 2, 1, BLOCK_TYPES.DIRT);

    expect(world.addFallingBlock(1, WORLD_HEIGHT - 2, 1)).toBe(true);
    expect(world.getBlock(1, WORLD_HEIGHT - 2, 1)).toBe(BLOCK_TYPES.AIR);
  });

  test('resets falling voxels before switching the world seed', () => {
    const world = new World('test-old-dynamic-world');
    world.setBlock(1, WORLD_HEIGHT - 2, 1, BLOCK_TYPES.SAND);
    expect(world.dynamicMaterials.getActiveCount()).toBe(1);
    const setBlockSpy = vi.spyOn(world, 'setBlock');

    world.setSeed('test-new-dynamic-world');
    world.dynamicMaterials.update(20);

    expect(world.dynamicMaterials.getActiveCount()).toBe(0);
    expect(setBlockSpy).not.toHaveBeenCalled();
  });

  test('persists a detached voxel while it is falling', () => {
    const original = new World('test-dynamic-save');
    original.setBlock(1, WORLD_HEIGHT - 2, 1, BLOCK_TYPES.SAND);
    original.dynamicMaterials.update(0.05);

    const serialized = original.saveWorld();
    const encoded = JSON.parse(serialized);
    const loaded = new World('test-dynamic-save');
    loaded.loadWorld(serialized);

    expect(encoded.dynamicMaterials).toMatchObject({
      schemaVersion: 1,
      bodies: [{ blockId: BLOCK_TYPES.SAND }],
    });
    expect(loaded.dynamicMaterials.getActiveCount()).toBe(1);
  });

  test('clears active voxels when loading a legacy world without dynamic state', () => {
    const world = new World('test-legacy-dynamic-save');
    world.setBlock(1, WORLD_HEIGHT - 2, 1, BLOCK_TYPES.SAND);
    expect(world.dynamicMaterials.getActiveCount()).toBe(1);

    world.loadWorld(JSON.stringify({
      seed: 'test-legacy-dynamic-save',
      modified: {},
      entities: JSON.stringify([]),
    }));

    expect(world.dynamicMaterials.getActiveCount()).toBe(0);
  });

  test.each([
    ['top-level shape', JSON.stringify([])],
    ['modified block type', JSON.stringify({
      seed: 'test-rejected-world',
      modified: { '0,0,0': { '0,0,0': 'stone' } },
      entities: JSON.stringify([]),
      dynamicMaterials: EMPTY_DYNAMIC_MATERIAL_SNAPSHOT,
    })],
    ['block entity payload', JSON.stringify({
      seed: 'test-rejected-world',
      modified: {},
      entities: '{invalid-json',
      dynamicMaterials: EMPTY_DYNAMIC_MATERIAL_SNAPSHOT,
    })],
    ['dynamic material schema', JSON.stringify({
      seed: 'test-rejected-world',
      modified: {},
      entities: JSON.stringify([]),
      dynamicMaterials: { schemaVersion: 2, bodies: [] },
    })],
  ])('rejects invalid world %s before mutating runtime state', (_field, serialized) => {
    const world = new World('test-existing-world');
    world.modifiedBlocks.set('1,2,3', new Map([['4,5,6', BLOCK_TYPES.STONE]]));
    world.blockEntities.createEntity('lever', 7, 8, 9);

    expect(() => world.loadWorld(serialized)).toThrow();
    expect(world.getSeed()).toBe('test-existing-world');
    expect(Array.from(world.modifiedBlocks.entries())).toEqual([
      ['1,2,3', new Map([['4,5,6', BLOCK_TYPES.STONE]])],
    ]);
    expect(world.blockEntities.getEntity(7, 8, 9)?.type).toBe('lever');
  });

  test('should successfully serialize and deserialize world state with modified blocks', () => {
    const originalWorld = new World('test-seed');

    // Set some custom blocks
    originalWorld.setBlock(1, 10, 1, BLOCK_TYPES.STONE);
    originalWorld.setBlock(2, 12, 3, BLOCK_TYPES.DIAMOND);
    originalWorld.setBlock(5, 5, 5, BLOCK_TYPES.GLASS);

    // Serialize
    const saveStr = originalWorld.saveWorld();
    const saved = JSON.parse(saveStr);

    // Check serialization structure
    expect(saved.seed).toBe('test-seed');
    expect(saved.modified).toBeDefined();

    // Load into a new world instance
    const loadedWorld = new World('test-seed');
    loadedWorld.loadWorld(saveStr);

    // Verify block restoration
    expect(loadedWorld.getBlock(1, 10, 1)).toBe(BLOCK_TYPES.STONE);
    expect(loadedWorld.getBlock(2, 12, 3)).toBe(BLOCK_TYPES.DIAMOND);
    expect(loadedWorld.getBlock(5, 5, 5)).toBe(BLOCK_TYPES.GLASS);
  });

  test('should revert modification tracking if block is changed back to its original state', () => {
    const world = new World('revert-seed');

    // Get original type of a block before modification
    const ox = 2, oy = 8, oz = 2;
    const originalType = world.getBlock(ox, oy, oz);

    // Modify it
    const tempType = originalType === BLOCK_TYPES.STONE ? BLOCK_TYPES.DIRT : BLOCK_TYPES.STONE;
    world.setBlock(ox, oy, oz, tempType);
    expect(world.modifiedBlocks.size).toBeGreaterThan(0);

    // Modify it back to original type
    world.setBlock(ox, oy, oz, originalType);

    // Save and check that modified map is now empty (no records saved)
    const saveStr = world.saveWorld();
    const saved = JSON.parse(saveStr);
    expect(saved.modified).toEqual({});
  });

  test('should minimize save size significantly by only recording modified blocks', () => {
    const world = new World('size-seed');

    // No modifications
    const emptySave = world.saveWorld();
    const emptySaved = JSON.parse(emptySave);
    expect(emptySaved.modified).toEqual({});
    expect(emptySave.length).toBeLessThan(128); // Includes the empty versioned dynamic snapshot.

    // Make only 1 modification
    world.setBlock(0, 5, 0, BLOCK_TYPES.DIAMOND);
    const modifiedSave = world.saveWorld();
    const modifiedSaved = JSON.parse(modifiedSave);
    expect(Object.keys(modifiedSaved.modified).length).toBe(1);
    expect(modifiedSave.length).toBeLessThan(200); // Still extremely small!
  });
});
