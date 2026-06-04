/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect } from 'vitest';
import { World } from '../World';
import { BLOCK_TYPES } from '../BlockConfig';
import { BlockRegistry } from './BlockRegistry';

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

describe('Saplings and Leaves Decay/Growth Systems', () => {
  test('should successfully register all sapling varieties', () => {
    const oakSapling = BlockRegistry.get(BLOCK_TYPES.OAK_SAPLING);
    expect(oakSapling).toBeDefined();
    expect(oakSapling.name).toBe('橡树树苗');
    expect(oakSapling.properties.hardness).toBe(0);
    expect(oakSapling.properties.isSolid).toBe(true);
    expect(oakSapling.properties.isCollidable).toBe(false);
    expect(oakSapling.properties.isCrossModel).toBe(true);

    const birchSapling = BlockRegistry.get(BLOCK_TYPES.BIRCH_SAPLING);
    expect(birchSapling).toBeDefined();
    expect(birchSapling.name).toBe('桦树树苗');
    expect(birchSapling.properties.isSolid).toBe(true);
    expect(birchSapling.properties.isCollidable).toBe(false);
    expect(birchSapling.properties.isCrossModel).toBe(true);

    const spruceSapling = BlockRegistry.get(BLOCK_TYPES.SPRUCE_SAPLING);
    expect(spruceSapling).toBeDefined();
    expect(spruceSapling.name).toBe('松树树苗');
    expect(spruceSapling.properties.isSolid).toBe(true);
    expect(spruceSapling.properties.isCollidable).toBe(false);
    expect(spruceSapling.properties.isCrossModel).toBe(true);

    const jungleSapling = BlockRegistry.get(BLOCK_TYPES.JUNGLE_SAPLING);
    expect(jungleSapling).toBeDefined();
    expect(jungleSapling.name).toBe('丛林树苗');
    expect(jungleSapling.properties.isSolid).toBe(true);
    expect(jungleSapling.properties.isCollidable).toBe(false);
    expect(jungleSapling.properties.isCrossModel).toBe(true);
  });

  test('should register leaf blocks with renderAdjacentSameType and renderInternalCross properties', () => {
    const leafTypes = [
      BLOCK_TYPES.LEAF,
      BLOCK_TYPES.BIRCH_LEAVES,
      BLOCK_TYPES.SPRUCE_LEAVES,
      BLOCK_TYPES.JUNGLE_LEAVES
    ];

    for (const type of leafTypes) {
      const block = BlockRegistry.get(type);
      expect(block).toBeDefined();
      expect(block.properties.renderAdjacentSameType).toBe(true);
      expect(block.properties.renderInternalCross).toBe(true);
    }
  });

  test('leaf blocks should not drop leaf blocks when broken, but may drop saplings', () => {
    const leaf = BlockRegistry.get(BLOCK_TYPES.LEAF);
    const drops = leaf.getDrops();
    
    // It should never drop itself
    const dropsSelf = drops.some((d: any) => d.type === BLOCK_TYPES.LEAF);
    expect(dropsSelf).toBe(false);

    // It should either drop nothing or drop a sapling
    if (drops.length > 0) {
      expect(drops[0].type).toBe(BLOCK_TYPES.OAK_SAPLING);
      expect(drops[0].count).toBe(1);
    }
  });

  test('leaves should decay when not connected to wood block within Manhattan distance of 4', () => {
    const world = new World('test-seed');
    world.updateChunkMesh = () => {}; // Bypass slow WebGL mesh updates in unit test

    // 1. Build a mini tree: trunk at (10,10,10), leaf at (10,11,10)
    world.setBlock(10, 9, 10, BLOCK_TYPES.DIRT);
    world.setBlock(10, 10, 10, BLOCK_TYPES.WOOD);
    world.setBlock(10, 11, 10, BLOCK_TYPES.LEAF);

    // Verify connection to wood is true
    expect(world.isConnectedToWood(10, 11, 10)).toBe(true);

    // 2. Break wood block (set to AIR)
    world.setBlock(10, 10, 10, BLOCK_TYPES.AIR);

    // Verify connection to wood is now false
    expect(world.isConnectedToWood(10, 11, 10)).toBe(false);

    // 3. Trigger leaf decay check
    world.checkLeafDecay(10, 11, 10);

    // 4. Update world time to trigger decay timer (e.g. 5.0 seconds)
    world.update(5.0);

    // 5. Leaf block should now decay to AIR
    expect(world.getBlock(10, 11, 10)).toBe(BLOCK_TYPES.AIR);
  });

  test('saplings should grow into trees over time when planted on valid ground', () => {
    const world = new World('test-seed');
    world.updateChunkMesh = () => {}; // Bypass slow WebGL mesh updates in unit test

    // Plant oak sapling on grass
    world.setBlock(10, 9, 10, BLOCK_TYPES.GRASS);
    
    // Clear area above ground for tree growth
    for (let lx = 6; lx <= 14; lx++) {
      for (let lz = 6; lz <= 14; lz++) {
        for (let ly = 10; ly <= 22; ly++) {
          world.setBlock(lx, ly, lz, BLOCK_TYPES.AIR);
        }
      }
    }

    world.setBlock(10, 10, 10, BLOCK_TYPES.OAK_SAPLING);

    // Verify sapling is placed
    expect(world.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.OAK_SAPLING);

    // Update time by 25.0 seconds to exceed the grow timer (10 to 20 seconds)
    world.update(25.0);

    // The sapling should have grown into an Oak tree!
    // The base block (10, 10, 10) should now be WOOD (trunk)
    expect(world.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.WOOD);

    // The block below should have turned to DIRT
    expect(world.getBlock(10, 9, 10)).toBe(BLOCK_TYPES.DIRT);

    // Find the trunk height by scanning upwards for WOOD
    let trunkHeight = 0;
    while (world.getBlock(10, 10 + trunkHeight, 10) === BLOCK_TYPES.WOOD) {
      trunkHeight++;
    }
    expect(trunkHeight).toBeGreaterThanOrEqual(4);
    expect(trunkHeight).toBeLessThanOrEqual(6);

    // The leaf block should be present directly above the trunk + 1 (since ly=0 center is skipped, ly=1 is LEAF)
    expect(world.getBlock(10, 10 + trunkHeight + 1, 10)).toBe(BLOCK_TYPES.LEAF);
  });
});
