import { vi, describe, test, expect } from 'vitest';
import { World, WORLD_HEIGHT } from './World';
import { BLOCK_TYPES } from './BlockConfig';
import { WorldGenerator } from './WorldGenerator';
import { WORLD_CONFIG } from './WorldConfig';
import { buildChunkVisibilitySummary } from './streaming/ChunkVisibilitySummary';

const TEST_CHUNK_BYTE_LENGTH = 16 * 16 * 16 * 2;
const HIGH_POND_CENTER_Y = 150;
const HIGH_POND_LOAD_RADIUS = 2;
const HIGH_POND_SCAN_MAX_Y = (
  Math.floor(HIGH_POND_CENTER_Y / 16) + HIGH_POND_LOAD_RADIUS + 1
) * 16;

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

describe('World chunk modification revisions', () => {
  test('increments revision once for a changed batch and not again for identical data', () => {
    const world = new World('test-modification-revision');
    const key = '0,0,0';
    const chunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
    const initialRevision = world.getChunkRevision(key);
    world.modifiedBlocks.set(key, new Map([
      ['0,0,0', BLOCK_TYPES.STONE],
      ['1,0,0', BLOCK_TYPES.DIRT],
    ]));
    world.applyChunkVisibilitySummary(
      key,
      buildChunkVisibilitySummary(chunk, initialRevision),
    );

    world.applyChunkModifications(key, chunk);

    expect(world.getChunkRevision(key)).toBe(initialRevision + 1);
    expect(world.getChunkVisibilitySummary(key)).toBeUndefined();
    expect(chunk[0]).toBe(BLOCK_TYPES.STONE);
    expect(chunk[2]).toBe(BLOCK_TYPES.DIRT);

    world.applyChunkModifications(key, chunk);
    expect(world.getChunkRevision(key)).toBe(initialRevision + 1);
  });

  test('applies the revision contract during synchronous getBlock generation', () => {
    const world = new World('test-get-block-modification-revision');
    const key = '0,0,0';
    const generated = world.generator.generateChunkData(0, 0, 0);
    const modifiedType = generated[0] === BLOCK_TYPES.STONE
      ? BLOCK_TYPES.DIRT
      : BLOCK_TYPES.STONE;
    world.modifiedBlocks.set(key, new Map([['0,0,0', modifiedType]]));
    world.applyChunkVisibilitySummary(
      key,
      buildChunkVisibilitySummary(generated, world.getChunkRevision(key)),
    );

    expect(world.getBlock(0, 0, 0)).toBe(modifiedType);
    expect(world.getChunkRevision(key)).toBe(1);
    expect(world.getChunkVisibilitySummary(key)).toBeUndefined();

    world.getBlock(0, 0, 0);
    expect(world.getChunkRevision(key)).toBe(1);
  });

  test('applies the revision contract during synchronous area loading', () => {
    const world = new World('test-sync-load-modification-revision');
    const key = '0,1,0';
    const generated = world.generator.generateChunkData(0, 1, 0);
    const modifiedType = generated[0] === BLOCK_TYPES.STONE
      ? BLOCK_TYPES.DIRT
      : BLOCK_TYPES.STONE;
    world.modifiedBlocks.set(key, new Map([['0,0,0', modifiedType]]));
    world.applyChunkVisibilitySummary(
      key,
      buildChunkVisibilitySummary(generated, world.getChunkRevision(key)),
    );

    world.loadArea(0, 16, 0, 0, true);

    expect(world.chunks.get(key)?.[0]).toBe(modifiedType);
    expect(world.getChunkRevision(key)).toBe(1);
    expect(world.getChunkVisibilitySummary(key)).toBeUndefined();

    world.loadArea(0, 16, 0, 0, true);
    expect(world.getChunkRevision(key)).toBe(1);
  });
});

describe('World Cave and Dry Land Ocean Mask Generation', () => {
  test('should generate dry land below waterLevel when oceanNoise is above threshold', () => {
    const world = new World('cloudcraft-seed');
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
    const world = new World('cloudcraft-seed');
    
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
    const world = new World('cloudcraft-seed');
    world.loadArea(0, 150, 0, 2);

    let foundUndergroundCave = false;
    for (let x = -32; x < 32; x++) {
      for (let z = -32; z < 32; z++) {
        let surfaceHeight = 63;
        while (surfaceHeight > 0 && world.getBlock(x, surfaceHeight, z) === BLOCK_TYPES.AIR) {
          surfaceHeight--;
        }
        
        if (surfaceHeight > 25) {
          // Check range y=20 to y=35 (centered around the Y=28 layer) for cave air pockets
          for (let y = 20; y < 35; y++) {
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
    const world = new World('cloudcraft-seed');
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
    const config = WORLD_CONFIG as unknown as { pond: { probability: number } };
    const originalProb = config.pond.probability;
    config.pond.probability = 1.0; // Temporarily raise pond probability to 100% to guarantee generation

    try {
      let foundHighPondWater = false;
      
      // With 100% probability, we can search in just the first few regions
      for (const offset of [-64, 192, 448]) {
        const world = new World('cloudcraft-seed');
        world.loadArea(offset, HIGH_POND_CENTER_Y, offset, HIGH_POND_LOAD_RADIUS);
        
        for (let x = offset - 32; x < offset + 32; x++) {
          for (let z = offset - 32; z < offset + 32; z++) {
            for (let y = 152; y < HIGH_POND_SCAN_MAX_Y; y++) {
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
    } finally {
      config.pond.probability = originalProb; // Always restore probability
    }
  }, 20000);

  test('should not generate exposed floating water walls at high altitudes for ponds', () => {
    const config = WORLD_CONFIG as unknown as { pond: { probability: number } };
    const originalProb = config.pond.probability;
    config.pond.probability = 1.0; // Temporarily raise pond probability to 100%

    try {
      let checkedPondRegions = 0;
      let exposedWaterCount = 0;

      for (const offset of [-64, 192, 448]) {
        const world = new World('cloudcraft-seed');
        world.loadArea(offset, HIGH_POND_CENTER_Y, offset, HIGH_POND_LOAD_RADIUS);
        
        let hasHighWater = false;
        // Scan coordinate range inside the loaded region
        const checkMin = offset - 16;
        const checkMax = offset + 16;
        
        for (let x = checkMin; x < checkMax; x++) {
          for (let z = checkMin; z < checkMax; z++) {
            for (let y = 151; y < HIGH_POND_SCAN_MAX_Y; y++) {
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
    } finally {
      config.pond.probability = originalProb; // Always restore probability
    }
  }, 20000);

  test('should never generate floating vegetation (vegetation block on top of AIR)', () => {
    const world = new World('cloudcraft-seed');
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
    const config = WORLD_CONFIG as unknown as { pond: { probability: number } };
    const originalProb = config.pond.probability;
    config.pond.probability = 1.0; // Temporarily raise pond probability to 100%

    try {
      const world = new World('cloudcraft-seed');
      const generator = new WorldGenerator('cloudcraft-seed');
      
      const valleyStart = WORLD_CONFIG.river.threshold + WORLD_CONFIG.river.transitionWidth;

      let checkedWaterBlocks = 0;
      // With 100% probability, we can verify this safety distance in just a couple of regions
      for (const offset of [-64, 192]) {
        world.loadArea(offset, 150, offset, 2);
        
        const checkMin = offset - 32;
        const checkMax = offset + 32;
        
        for (let x = checkMin; x < checkMax; x++) {
          for (let z = checkMin; z < checkMax; z++) {
            const rawHeight = generator.getRawHeightAt(x, z);
            const pond = generator.getPondValue(x, z, rawHeight);
            if (!pond.isPond) continue;

            const minimumWaterY = Math.max(151, Math.floor(pond.bedHeight));
            const maximumWaterY = Math.min(
              WORLD_HEIGHT - 2,
              Math.ceil(pond.waterLevel),
            );
            for (let y = minimumWaterY; y <= maximumWaterY; y++) {
              if (world.getBlock(x, y, z) === BLOCK_TYPES.WATER) {
                const { dRiver } = generator.getRiverValue(x, z);
                expect(dRiver).toBeGreaterThanOrEqual(valleyStart);
                checkedWaterBlocks++;
              }
            }
          }
        }
      }
      
      expect(checkedWaterBlocks).toBeGreaterThan(0);
    } finally {
      config.pond.probability = originalProb; // Always restore probability
    }
  }, 20000);
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
    expect(priority('0,1,0')).toBe(4); // Diff Y plane by 1, horizontal distance 0 (weighted)
    expect(priority('0,-1,0')).toBe(4); // Diff Y plane by 1, horizontal distance 0 (weighted)
    expect(priority('0,1,1')).toBe(5); // Diff Y plane by 1, horizontal distance 1 (weighted)
    
    // Sort array:
    const list = ['0,1,1', '1,0,1', '0,-1,0', '0,0,1', '0,0,0', '0,1,0'];
    list.sort((a, b) => priority(a) - priority(b));
    
    // Expected sorted order:
    // 1. '0,0,0' (priority 0)
    // 2. '0,0,1' (priority 1)
    // 3. '1,0,1' (priority 2)
    // 4. '0,-1,0' or '0,1,0' (priority 4)
    // 5. '0,1,0' or '0,-1,0' (priority 4)
    // 6. '0,1,1' (priority 5)
    expect(list[0]).toBe('0,0,0');
    expect(list[1]).toBe('0,0,1');
    expect(list[2]).toBe('1,0,1');
    expect(priority(list[3])).toBe(4);
    expect(priority(list[4])).toBe(4);
    expect(list[5]).toBe('0,1,1');
  });
});


