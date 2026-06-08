import { vi, describe, test, expect } from 'vitest';
import { World, WORLD_HEIGHT } from './World';
import { BLOCK_TYPES } from './BlockConfig';
import { WorldGenerator } from './WorldGenerator';
import { WORLD_CONFIG } from './WorldConfig';

// Bypass slow WebGL mesh updates globally in this test suite
World.prototype.updateChunkMesh = () => {};

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

describe('World Serialization by Modified Blocks Tracking', () => {
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
    expect(emptySave.length).toBeLessThan(100); // Extremely small!
    
    // Make only 1 modification
    world.setBlock(0, 5, 0, BLOCK_TYPES.DIAMOND);
    const modifiedSave = world.saveWorld();
    const modifiedSaved = JSON.parse(modifiedSave);
    expect(Object.keys(modifiedSaved.modified).length).toBe(1);
    expect(modifiedSave.length).toBeLessThan(200); // Still extremely small!
  });


});

describe('World Cave and Dry Land Ocean Mask Generation', () => {
  test('should generate dry land below waterLevel when oceanNoise is above threshold', () => {
    const world = new World('webcraft-seed');
    world.loadArea(0, 150, 0, 2);
    
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
  }, 20000);

  test('should generate grass on surface when dry land is below waterLevel', () => {
    const world = new World('webcraft-seed');
    
    let verified = false;
    for (let offset = 0; offset < 2000; offset += 64) {
      world.loadArea(offset, 150, offset, 2);
      
      for (let x = offset - 32; x < offset + 32; x++) {
        for (let z = offset - 32; z < offset + 32; z++) {
          // Find surface height
          let y = 220; // Limit search height to 220 to avoid generating high-altitude air chunks
          while (y > 0 && world.getBlock(x, y, z) === BLOCK_TYPES.AIR) {
            y--;
          }
          
          const surfaceBlock = world.getBlock(x, y, z);
          
          // If surface is close to waterLevel (<= 151) and it's dry (not water)
          if (y <= 151 && surfaceBlock !== BLOCK_TYPES.WATER && surfaceBlock !== BLOCK_TYPES.AIR) {
            // It should generate grass instead of sand in grassy biomes
            if (surfaceBlock === BLOCK_TYPES.GRASS) {
              verified = true;
              break;
            }
          }
        }
        if (verified) break;
      }
      if (verified) break;
    }
    expect(verified).toBe(true);
  }, 20000);

  test('should generate caves (AIR pockets) underground inside stone layers', () => {
    const world = new World('webcraft-seed');
    world.loadArea(0, 150, 0, 2);

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
  }, 20000);

  test('should not generate exposed floating water walls adjacent to air', () => {
    const world = new World('webcraft-seed');
    world.loadArea(0, 150, 0, 3); // Load a 3x3 chunk area

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
  }, 20000);

  test('should generate high-altitude ponds on land with water blocks above sea level', () => {
    let foundHighPondWater = false;
    
    // Search different regions to find a high-altitude pond (since probability is 3%)
    for (let offset = 0; offset < 2000; offset += 64) {
      const world = new World('webcraft-seed');
      world.loadArea(offset, 150, offset, 2); // Load a 5x5 chunk area (80x80 blocks)
      
      for (let x = offset - 32; x < offset + 32; x++) {
        for (let z = offset - 32; z < offset + 32; z++) {
          for (let y = 152; y < 250; y++) {
            if (world.getBlock(x, y, z) === BLOCK_TYPES.WATER) {
              foundHighPondWater = true;
              break;
            }
          }
          if (foundHighPondWater) break;
        }
        if (foundHighPondWater) break;
      }
      if (foundHighPondWater) break;
    }
    expect(foundHighPondWater).toBe(true);
  }, 30000);

  test('should not generate exposed floating water walls at high altitudes for ponds', () => {
    let checkedPondRegions = 0;
    let exposedWaterCount = 0;

    for (let offset = 0; offset < 2000; offset += 64) {
      const world = new World('webcraft-seed');
      // Load a 5x5 chunk area (80x80 blocks) centered around offset
      world.loadArea(offset, 150, offset, 2);
      
      let hasHighWater = false;
      // Scan coordinate range inside the loaded region
      const checkMin = offset - 16;
      const checkMax = offset + 16;
      
      for (let x = checkMin; x < checkMax; x++) {
        for (let z = checkMin; z < checkMax; z++) {
          for (let y = 151; y < WORLD_HEIGHT - 2; y++) {
            if (world.getBlock(x, y, z) === BLOCK_TYPES.WATER) {
              hasHighWater = true;
              
              const neighbors = [
                { name: 'X+1', val: world.getBlock(x + 1, y, z) },
                { name: 'X-1', val: world.getBlock(x - 1, y, z) },
                { name: 'Z+1', val: world.getBlock(x, y, z + 1) },
                { name: 'Z-1', val: world.getBlock(x, y, z - 1) }
              ];
              
              for (const neighbor of neighbors) {
                if (neighbor.val === BLOCK_TYPES.AIR) {
                  console.log(`Exposed high-altitude water at: (${x}, ${y}, ${z}) during test, neighbor ${neighbor.name} is AIR`);
                  exposedWaterCount++;
                }
              }
            }
          }
        }
      }
      
      if (hasHighWater) {
        checkedPondRegions++;
        if (checkedPondRegions >= 1) {
          break;
        }
      }
    }
    
    expect(checkedPondRegions).toBeGreaterThan(0);
    expect(exposedWaterCount).toBe(0);
  }, 30000);

  test('should never generate floating vegetation (vegetation block on top of AIR)', () => {
    const world = new World('webcraft-seed');
    world.loadArea(0, 150, 0, 2);

    let floatingCount = 0;
    const vegTypes = new Set<number>([
      BLOCK_TYPES.TALL_GRASS,
      BLOCK_TYPES.DANDELION,
      BLOCK_TYPES.POPPY,
      BLOCK_TYPES.OXEYE_DAISY,
      BLOCK_TYPES.SUNFLOWER_BOTTOM,
      BLOCK_TYPES.SUNFLOWER_TOP,
      BLOCK_TYPES.ROSE_BUSH_BOTTOM,
      BLOCK_TYPES.ROSE_BUSH_TOP,
      BLOCK_TYPES.PEONY_BOTTOM,
      BLOCK_TYPES.PEONY_TOP,
      BLOCK_TYPES.LILAC_BOTTOM,
      BLOCK_TYPES.LILAC_TOP,
      BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM,
      BLOCK_TYPES.DOUBLE_TALL_GRASS_TOP
    ]);

    for (let x = -32; x < 32; x++) {
      for (let z = -32; z < 32; z++) {
        for (let y = 10; y < 250; y++) {
          const block = world.getBlock(x, y, z);
          if (vegTypes.has(block)) {
            const below = world.getBlock(x, y - 1, z);
            if (below === BLOCK_TYPES.AIR) {
              floatingCount++;
            }
          }
        }
      }
    }

    expect(floatingCount).toBe(0);
  }, 20000);

  test('should not generate ponds near rivers', () => {
    const world = new World('webcraft-seed');
    const generator = new WorldGenerator('webcraft-seed');
    
    const valleyStart = WORLD_CONFIG.river.threshold + WORLD_CONFIG.river.transitionWidth;
    const valleyEnd = valleyStart + WORLD_CONFIG.river.valleyInfluenceWidth;

    let checkedWaterBlocks = 0;
    for (let offset = 0; offset < 2000; offset += 64) {
      world.loadArea(offset, 150, offset, 2);
      
      const checkMin = offset - 32;
      const checkMax = offset + 32;
      
      for (let x = checkMin; x < checkMax; x++) {
        for (let z = checkMin; z < checkMax; z++) {
          for (let y = 151; y < WORLD_HEIGHT - 2; y++) {
            if (world.getBlock(x, y, z) === BLOCK_TYPES.WATER) {
              const { dRiver } = generator.getRiverValue(x, z);
              expect(dRiver).toBeGreaterThanOrEqual(valleyEnd);
              checkedWaterBlocks++;
            }
          }
        }
      }
    }
    
    expect(checkedWaterBlocks).toBeGreaterThan(0);
  }, 120000);
});

describe('World Chunk Loading Priority and Custom Sorting', () => {
  test('should prioritize chunks on the same horizontal plane (Y-level difference is minimized) and then by horizontal distance', () => {
    const world = new World('priority-test');
    const ccx = 0, ccy = 0, ccz = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priority = (key: string) => (world as any).getChunkPriority(key, ccx, ccy, ccz);
    
    expect(priority('0,0,0')).toBe(0); // Player chunk has absolute priority
    expect(priority('0,0,1')).toBe(1); // Same Y plane, horizontal distance 1
    expect(priority('1,0,1')).toBe(2); // Same Y plane, horizontal distance sqrt(2)
    expect(priority('0,1,0')).toBe(1000); // Diff Y plane by 1, horizontal distance 0
    expect(priority('0,-1,0')).toBe(1000); // Diff Y plane by 1, horizontal distance 0
    expect(priority('0,1,1')).toBe(1001); // Diff Y plane by 1, horizontal distance 1
    
    // Sort array:
    const list = ['0,1,1', '1,0,1', '0,-1,0', '0,0,1', '0,0,0', '0,1,0'];
    list.sort((a, b) => priority(a) - priority(b));
    
    // Expected sorted order:
    // 1. '0,0,0' (priority 0)
    // 2. '0,0,1' (priority 1)
    // 3. '1,0,1' (priority 2)
    // 4. '0,-1,0' or '0,1,0' (priority 1000)
    // 5. '0,1,0' or '0,-1,0' (priority 1000)
    // 6. '0,1,1' (priority 1001)
    expect(list[0]).toBe('0,0,0');
    expect(list[1]).toBe('0,0,1');
    expect(list[2]).toBe('1,0,1');
    expect(priority(list[3])).toBe(1000);
    expect(priority(list[4])).toBe(1000);
    expect(list[5]).toBe('0,1,1');
  });
});


