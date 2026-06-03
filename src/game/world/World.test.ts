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

describe('World Cave and Dry Land Ocean Mask Generation', () => {
  test('should generate dry land below waterLevel when oceanNoise is above threshold', () => {
    const world = new World('minicraft-seed');
    world.loadArea(0, 0, 2);
    
    let foundDryLandBelowSeaLevel = false;
    for (let x = -32; x < 32; x += 2) {
      for (let z = -32; z < 32; z += 2) {
        const block = world.getBlock(x, 120, z);
        const block2 = world.getBlock(x, 149, z);
        if (block === BLOCK_TYPES.AIR || block2 === BLOCK_TYPES.AIR) {
          foundDryLandBelowSeaLevel = true;
          break;
        }
      }
      if (foundDryLandBelowSeaLevel) break;
    }
    expect(foundDryLandBelowSeaLevel).toBe(true);
  });

  test('should generate grass on surface when dry land is below waterLevel', () => {
    const world = new World('minicraft-seed');
    world.loadArea(0, 0, 2);
    
    let verified = false;
    for (let x = -32; x < 32; x++) {
      for (let z = -32; z < 32; z++) {
        // Find surface height
        let y = CHUNK_SIZE_Y - 2;
        while (y > 0 && world.getBlock(x, y, z) === BLOCK_TYPES.AIR) {
          y--;
        }
        
        const surfaceBlock = world.getBlock(x, y, z);
        
        // If surface is below waterLevel (150) and it's dry (not water)
        if (y < 150 && surfaceBlock !== BLOCK_TYPES.WATER && surfaceBlock !== BLOCK_TYPES.AIR) {
          // It should generate grass instead of sand in grassy biomes
          if (surfaceBlock === BLOCK_TYPES.GRASS) {
            verified = true;
            break;
          }
        }
      }
      if (verified) break;
    }
    expect(verified).toBe(true);
  });

  test('should generate caves (AIR pockets) underground inside stone layers', () => {
    const world = new World('minicraft-seed');
    world.loadArea(0, 0, 2);

    let foundUndergroundCave = false;
    for (let x = -32; x < 32; x++) {
      for (let z = -32; z < 32; z++) {
        let surfaceHeight = 63;
        while (surfaceHeight > 0 && world.getBlock(x, surfaceHeight, z) === BLOCK_TYPES.AIR) {
          surfaceHeight--;
        }
        
        if (surfaceHeight > 25) {
          // Check range y=5 to y=15 for cave air pockets
          for (let y = 5; y < 15; y++) {
            if (world.getBlock(x, y, z) === BLOCK_TYPES.AIR) {
              foundUndergroundCave = true;
              break;
            }
          }
        }
        if (foundUndergroundCave) break;
      }
      if (foundUndergroundCave) break;
    }
    expect(foundUndergroundCave).toBe(true);
  });

  test('should not generate exposed floating water walls adjacent to air', () => {
    const world = new World('minicraft-seed');
    world.loadArea(0, 0, 3); // Load a 3x3 chunk area

    let exposedWaterCount = 0;
    
    // Scan global coordinates inside the loaded area to check all water blocks
    for (let x = -32; x < 32; x++) {
      for (let z = -32; z < 32; z++) {
        for (let y = 1; y <= 150; y++) {
          if (world.getBlock(x, y, z) === BLOCK_TYPES.WATER) {
            const neighbors = [
              { name: 'X+1', val: world.getBlock(x + 1, y, z) },
              { name: 'X-1', val: world.getBlock(x - 1, y, z) },
              { name: 'Z+1', val: world.getBlock(x, y, z + 1) },
              { name: 'Z-1', val: world.getBlock(x, y, z - 1) }
            ];
            
            for (const neighbor of neighbors) {
              if (neighbor.val === BLOCK_TYPES.AIR) {
                console.log(`Exposed water at: (${x}, ${y}, ${z}), neighbor ${neighbor.name} is AIR`);
                exposedWaterCount++;
              }
            }
          }
        }
      }
    }
    
    expect(exposedWaterCount).toBe(0);
  });
});

