/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect } from 'vitest';
import { BLOCK_TYPES, getBlockProperties } from '../BlockConfig';
import { BlockRegistry } from './BlockRegistry';
import { World } from '../World';

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

describe('Block Orientation Bitwise Registry & Config', () => {
  test('should successfully get basic wood block definitions', () => {
    const wood = BlockRegistry.get(BLOCK_TYPES.WOOD);
    expect(wood).toBeDefined();
    expect(wood.id).toBe(BLOCK_TYPES.WOOD);
    expect(wood.isSolid).toBe(true);
  });

  test('should resolve correct properties for bit-encoded oriented wood blocks', () => {
    const woodX = BLOCK_TYPES.WOOD | (1 << 6); // WOOD on X-axis (68)
    const woodZ = BLOCK_TYPES.WOOD | (2 << 6); // WOOD on Z-axis (132)

    const propsBase = getBlockProperties(BLOCK_TYPES.WOOD);
    const propsX = getBlockProperties(woodX);
    const propsZ = getBlockProperties(woodZ);

    // All should resolve to identical properties of the base wood block Type
    expect(propsX.hardness).toBe(2.0);
    expect(propsZ.hardness).toBe(2.0);
    expect(propsX.soundType).toBe('wood');
    expect(propsZ.soundType).toBe('wood');
    expect(propsX.isSolid).toBe(true);
    expect(propsZ.isSolid).toBe(true);
    expect(propsX).toEqual(propsBase);
  });
});

describe('Block Orientation Bitwise Mesh Generation', () => {
  test('should allow setting block with bit-encoded wood orientations and compile meshes successfully', () => {
    const world = new World('test-seed');
    
    const woodX = BLOCK_TYPES.WOOD | (1 << 6);
    const woodZ = BLOCK_TYPES.WOOD | (2 << 6);

    // Set bit-encoded blocks in world
    world.setBlock(10, 10, 10, woodX);
    world.setBlock(10, 11, 10, woodZ);

    expect(world.getBlock(10, 10, 10)).toBe(woodX);
    expect(world.getBlock(10, 11, 10)).toBe(woodZ);

    // Check that getBlockProperties resolver ignores high bit metadata for fluid/solid checks
    expect(getBlockProperties(world.getBlock(10, 10, 10)).isSolid).toBe(true);

    // Call updateChunkMesh to verify mesh reconstruction succeeds
    expect(() => world.updateChunkMesh(0, 0)).not.toThrow();
  });
});
