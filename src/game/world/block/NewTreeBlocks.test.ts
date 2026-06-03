/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect } from 'vitest';
import { World, CHUNK_SIZE_X, CHUNK_SIZE_Z } from '../World';
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

describe('New Tree Blocks and Generic Generation Algorithm', () => {
  test('should successfully register new birch and spruce blocks with correct properties', () => {
    // 1. Birch Wood
    const birchWood = BlockRegistry.get(BLOCK_TYPES.BIRCH_WOOD);
    expect(birchWood).toBeDefined();
    expect(birchWood.name).toBe('桦木');
    expect(birchWood.isSolid).toBe(true);
    expect(birchWood.properties.soundType).toBe('wood');
    expect(birchWood.properties.hardness).toBe(2.0);

    // 2. Birch Leaves
    const birchLeaves = BlockRegistry.get(BLOCK_TYPES.BIRCH_LEAVES);
    expect(birchLeaves).toBeDefined();
    expect(birchLeaves.name).toBe('桦树叶');
    expect(birchLeaves.isSolid).toBe(true);
    expect(birchLeaves.properties.isTransparent).toBe(true);

    // 3. Spruce Wood
    const spruceWood = BlockRegistry.get(BLOCK_TYPES.SPRUCE_WOOD);
    expect(spruceWood).toBeDefined();
    expect(spruceWood.name).toBe('松木');
    expect(spruceWood.isSolid).toBe(true);
    expect(spruceWood.properties.soundType).toBe('wood');

    // 4. Spruce Leaves
    const spruceLeaves = BlockRegistry.get(BLOCK_TYPES.SPRUCE_LEAVES);
    expect(spruceLeaves).toBeDefined();
    expect(spruceLeaves.name).toBe('松树叶');
    expect(spruceLeaves.isSolid).toBe(true);
    expect(spruceLeaves.properties.isTransparent).toBe(true);
  });

  test('should grow oak tree using growTree algorithm', () => {
    const world = new World('test-seed');
    const chunk = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * 64);
    
    // Set grass block at center
    const tx = 8;
    const ty = 25;
    const tz = 8;
    chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z] = BLOCK_TYPES.GRASS;
    
    // Call growTree for oak
    const treeHeight = 5;
    (world as any).growTree(chunk, tx, ty, tz, BLOCK_TYPES.WOOD, BLOCK_TYPES.LEAF, treeHeight, 'oak');
    
    // 1. Ground should change to DIRT
    expect(chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.DIRT);
    
    // 2. Trunk should be generated for 5 blocks height
    for (let h = 1; h <= treeHeight; h++) {
      expect(chunk[tx + tz * CHUNK_SIZE_X + (ty + h) * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.WOOD);
    }
    
    // 3. Leaf canopy should be generated around tree top
    const leafCenterY = ty + treeHeight;
    // Just above tree top center should be LEAF (since we want at least one leaf block directly above the trunk center)
    expect(chunk[tx + tz * CHUNK_SIZE_X + (leafCenterY + 1) * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.LEAF);
    // Neighbors at the top layer should contain leaf (if not skipped by random variation)
    // We can check if it is either LEAF or AIR
    const neighborTop = chunk[(tx + 1) + tz * CHUNK_SIZE_X + (leafCenterY + 1) * CHUNK_SIZE_X * CHUNK_SIZE_Z];
    expect(neighborTop === BLOCK_TYPES.LEAF || neighborTop === BLOCK_TYPES.AIR).toBe(true);
    // Neighbors around top leaf center should contain leaf (if not skipped)
    const neighborMid = chunk[(tx + 1) + tz * CHUNK_SIZE_X + leafCenterY * CHUNK_SIZE_X * CHUNK_SIZE_Z];
    expect(neighborMid === BLOCK_TYPES.LEAF || neighborMid === BLOCK_TYPES.AIR).toBe(true);
  });

  test('should grow spruce tree with correct conical canopy shape', () => {
    const world = new World('test-seed');
    const chunk = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * 64);
    
    const tx = 8;
    const ty = 25;
    const tz = 8;
    chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z] = BLOCK_TYPES.GRASS;
    
    const treeHeight = 7;
    (world as any).growTree(chunk, tx, ty, tz, BLOCK_TYPES.SPRUCE_WOOD, BLOCK_TYPES.SPRUCE_LEAVES, treeHeight, 'spruce');
    
    // Ground changes to DIRT
    expect(chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.DIRT);
    
    // Trunk checks
    for (let h = 1; h <= treeHeight; h++) {
      expect(chunk[tx + tz * CHUNK_SIZE_X + (ty + h) * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.SPRUCE_WOOD);
    }
    
    const leafCenterY = ty + treeHeight;
    // The very top of the spruce tree (directly above trunk) should be SPRUCE_LEAVES
    expect(chunk[tx + tz * CHUNK_SIZE_X + (leafCenterY + 1) * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.SPRUCE_LEAVES);
    
    // Conical shape checks:
    // Neighbors at leafCenterY should be either SPRUCE_LEAVES or AIR due to random variation
    const spruceNeighbor = chunk[(tx + 1) + tz * CHUNK_SIZE_X + leafCenterY * CHUNK_SIZE_X * CHUNK_SIZE_Z];
    expect(spruceNeighbor === BLOCK_TYPES.SPRUCE_LEAVES || spruceNeighbor === BLOCK_TYPES.AIR).toBe(true);
    
    // At ly = -1, radius = 2, corner (tx+2, tz+2) should NOT be leaf (should be empty/AIR) because we round corners
    const idxCorner = (tx + 2) + (tz + 2) * CHUNK_SIZE_X + (leafCenterY - 1) * CHUNK_SIZE_X * CHUNK_SIZE_Z;
    expect(chunk[idxCorner]).toBe(BLOCK_TYPES.AIR);
  });
});
