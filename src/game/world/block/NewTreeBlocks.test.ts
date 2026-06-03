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
    // Just above tree top center should be AIR (due to trunk extension skip)
    expect(chunk[tx + tz * CHUNK_SIZE_X + (leafCenterY + 1) * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.AIR);
    // Neighbors at the top layer should contain leaf
    expect(chunk[(tx + 1) + tz * CHUNK_SIZE_X + (leafCenterY + 1) * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.LEAF);
    // Neighbors around top leaf center should contain leaf
    expect(chunk[(tx + 1) + tz * CHUNK_SIZE_X + leafCenterY * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.LEAF);
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
    // Conical shape checks:
    // Y = leafCenterY + 1 -> radius 0 (only spruce leaves directly at top Y+1 is false because ly > 0 is skipped on center, wait, in code:
    // if (lx === 0 && lz === 0 && ly > 0) continue;
    // So the very top above center is empty, but we can check adjacent slots or y = leafCenterY
    expect(chunk[(tx + 1) + tz * CHUNK_SIZE_X + leafCenterY * CHUNK_SIZE_X * CHUNK_SIZE_Z]).toBe(BLOCK_TYPES.SPRUCE_LEAVES);
    
    // At ly = -1, radius = 2, corner (tx+2, tz+2) should NOT be leaf (should be empty/AIR) because we round corners
    const idxCorner = (tx + 2) + (tz + 2) * CHUNK_SIZE_X + (leafCenterY - 1) * CHUNK_SIZE_X * CHUNK_SIZE_Z;
    expect(chunk[idxCorner]).toBe(BLOCK_TYPES.AIR);
  });
});
