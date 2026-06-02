import { vi, describe, test, expect } from 'vitest';
import { World, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './World';
import { BLOCK_TYPES } from './BlockConfig';

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

describe('World Serialization and RLE Compression', () => {
  test('should successfully serialize and deserialize world state with identical blocks', () => {
    const originalWorld = new World('test-seed');
    
    // Set some custom blocks
    originalWorld.setBlock(1, 10, 1, BLOCK_TYPES.STONE);
    originalWorld.setBlock(2, 12, 3, BLOCK_TYPES.DIAMOND);
    originalWorld.setBlock(5, 5, 5, BLOCK_TYPES.GLASS);
    
    // Serialize
    const saveStr = originalWorld.saveWorld();
    
    // Check that saveStr contains RLE delimiters '_'
    expect(saveStr).toContain('_');
    
    // Load into a new world instance
    const loadedWorld = new World('test-seed');
    loadedWorld.loadWorld(saveStr);
    
    // Verify block restoration
    expect(loadedWorld.getBlock(1, 10, 1)).toBe(BLOCK_TYPES.STONE);
    expect(loadedWorld.getBlock(2, 12, 3)).toBe(BLOCK_TYPES.DIAMOND);
    expect(loadedWorld.getBlock(5, 5, 5)).toBe(BLOCK_TYPES.GLASS);
  });

  test('should achieve significant compression ratio compared to legacy flat CSV format', () => {
    const world = new World('test-seed');
    
    // Load area to populate chunks
    world.loadArea(0, 0, 1);
    
    const saveStr = world.saveWorld();
    const savedData = JSON.parse(saveStr);
    
    // Total character length of all RLE chunks
    let rleTotalLength = 0;
    for (const csv of Object.values(savedData.chunks)) {
      rleTotalLength += (csv as string).length;
    }
    
    // In legacy format, each chunk is flat 16384 numbers separated by commas
    // Minimum length for a 16384 array of single digits with commas is 16384 * 2 - 1 = 32767 characters
    const expectedLegacyMinLength = (CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y) * 2 - 1;
    const legacyTotalLength = Object.keys(savedData.chunks).length * expectedLegacyMinLength;
    
    // The RLE compressed chunks should be much smaller (typically < 30% of legacy flat CSV size)
    expect(rleTotalLength).toBeLessThan(legacyTotalLength * 0.3); 
  });

  test('should support loading legacy flat CSV format for backward compatibility', () => {
    const loadedWorld = new World('compat-seed');
    const chunkLength = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
    
    // Create a flat CSV mock representation of a chunk (all AIR except one stone block and one diamond)
    const mockChunk = new Uint8Array(chunkLength);
    mockChunk[100] = BLOCK_TYPES.STONE;
    mockChunk[500] = BLOCK_TYPES.DIAMOND;
    const flatCsv = Array.from(mockChunk).join(',');
    
    const legacySave = JSON.stringify({
      seed: 'compat-seed',
      chunks: {
        '0,0': flatCsv
      }
    });
    
    // Load the legacy save
    loadedWorld.loadWorld(legacySave);
    
    // Verify correct parsing of flat CSV data
    expect(loadedWorld.getBlock(0, 0, 0)).toBe(BLOCK_TYPES.AIR); // index 0 (lx=0, lz=0, y=0) is bedrock stone in generator, but here overridden by AIR from load
    
    // Calculate global coordinates from local index
    // index = lx + lz * 16 + y * 256
    // index 100: 100 = 4 + 6 * 16 + 0 * 256 => lx=4, lz=6, y=0
    expect(loadedWorld.getBlock(4, 0, 6)).toBe(BLOCK_TYPES.STONE);
    
    // index 500: 500 = 4 + 15 * 16 + 1 * 256 => lx=4, lz=15, y=1
    expect(loadedWorld.getBlock(4, 1, 15)).toBe(BLOCK_TYPES.DIAMOND);
  });
});
