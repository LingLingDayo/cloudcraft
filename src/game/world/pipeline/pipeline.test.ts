vi.mock('../biome/BiomeRegistry', () => ({
  getBiomeAt: () => ({
    id: 'forest',
    name: '森林',
    fillColumn: () => {},
    getTreeProbability: () => 1.0,
    getTreeAttempts: () => 3,
    growDecorations: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).mockGrowDecorationsCalled = true;
    },
  })
}));

vi.mock('@game/world/biome/BiomeRegistry', () => ({
  getBiomeAt: () => ({
    id: 'forest',
    name: '森林',
    fillColumn: () => {},
    getTreeProbability: () => 1.0,
    getTreeAttempts: () => 3,
    growDecorations: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).mockGrowDecorationsCalled = true;
    },
  })
}));

import { vi, describe, test, expect } from 'vitest';
import '@game/world/block/BlockRegistry';
import { ChunkPipeline } from './ChunkPipeline';
import type { ChunkPipelineContext, ChunkPipelineStage } from './ChunkPipelineTypes';
import { ImprovedNoise } from '../Noise';
import { TerrainHeightMapStage } from './stages/TerrainHeightMapStage';
import { BaseTerrainFillerStage } from './stages/BaseTerrainFillerStage';
import { OreGeneratorStage } from './stages/OreGeneratorStage';
import { CaveCarverStage, isCaveAt } from './stages/CaveCarverStage';
import { SurfaceDecorationStage } from './stages/SurfaceDecorationStage';
import { TreeDecorationStage } from './stages/TreeDecorationStage';
import { BLOCK_TYPES } from '../BlockConfig';

describe('ChunkPipeline Extensions', () => {
  test('should execute stages in order and support dynamic insertion', () => {
    const pipeline = new ChunkPipeline();
    const executionOrder: string[] = [];

    const stageA: ChunkPipelineStage = {
      name: 'StageA',
      execute: () => { executionOrder.push('A'); }
    };
    const stageB: ChunkPipelineStage = {
      name: 'StageB',
      execute: () => { executionOrder.push('B'); }
    };
    const stageC: ChunkPipelineStage = {
      name: 'StageC',
      execute: () => { executionOrder.push('C'); }
    };

    pipeline.addStage(stageA);
    pipeline.addStage(stageC);
    pipeline.insertStageBefore('StageC', stageB);

    const mockContext: ChunkPipelineContext = {
      cx: 0, cy: 0, cz: 0,
      worldStartX: 0, worldStartY: 0, worldStartZ: 0,
      chunk: new Uint8Array(4096),
      noise: {} as ImprovedNoise,
      terrainMap: [],
      biomeMap: [],
      generator: {}
    };

    pipeline.execute(mockContext);
    expect(executionOrder).toEqual(['A', 'B', 'C']);
  });

  test('TerrainHeightMapStage should correctly compute 16x16 height map', () => {
    const pipeline = new ChunkPipeline();
    pipeline.addStage(new TerrainHeightMapStage());

    const mockNoise = {
      noise: vi.fn().mockReturnValue(0.1),
      noise3d: vi.fn().mockReturnValue(0.1),
    } as unknown as ImprovedNoise;

    const mockBiome = {
      id: 'plains',
      name: '平原',
    };

    const mockGenerator = {
      getPrimaryBiome: vi.fn().mockReturnValue(mockBiome),
      getRiverValue: vi.fn().mockReturnValue({ t: 0, bedHeight: 142, dRiver: 1.0, riverWeight: 1.0 }),
      getPondValue: vi.fn().mockReturnValue({ isPond: false, bedHeight: 170, centerT: 0, waterLevel: 150 }),
      getWaterLevelAt: vi.fn().mockReturnValue(0),
      getColumnTerrainData: vi.fn().mockReturnValue({
        adjustedHeight: 160,
        finalHeight: 160,
        localWaterLevel: 150,
        isDryLand: true,
        isPond: false,
        maxHeightOffset: 12,
        slope: 0
      })
    };

    const context: ChunkPipelineContext = {
      cx: 0, cy: 0, cz: 0,
      worldStartX: 0, worldStartY: 0, worldStartZ: 0,
      chunk: new Uint8Array(4096),
      noise: mockNoise,
      terrainMap: [],
      biomeMap: [],
      generator: mockGenerator
    };

    pipeline.execute(context);

    expect(context.terrainMap.length).toBe(16);
    expect(context.terrainMap[0].length).toBe(16);
    expect(context.biomeMap.length).toBe(16);
    expect(context.biomeMap[0].length).toBe(16);
    expect(context.terrainMap[0][0].finalHeight).toBe(160);
    expect(context.biomeMap[0][0].id).toBe('plains');
  });

  test('BaseTerrainFillerStage should fill chunk with bedrock and biome blocks', () => {
    const pipeline = new ChunkPipeline();
    pipeline.addStage(new TerrainHeightMapStage());
    pipeline.addStage(new BaseTerrainFillerStage());

    const mockNoise = {
      noise: vi.fn().mockReturnValue(0.1),
      noise3d: vi.fn().mockReturnValue(0.1),
    } as unknown as ImprovedNoise;

    const fillColumnSpy = vi.fn((chunk, lx, lz, y) => {
      const index = lx + lz * 16 + (y % 16) * 256;
      chunk[index] = BLOCK_TYPES.GRASS;
    });

    const mockBiome = {
      id: 'plains',
      name: '平原',
      fillColumn: fillColumnSpy,
    };

    const mockGenerator = {
      getPrimaryBiome: vi.fn().mockReturnValue(mockBiome),
      getRiverValue: vi.fn().mockReturnValue({ t: 0, bedHeight: 142, dRiver: 1.0, riverWeight: 1.0 }),
      getPondValue: vi.fn().mockReturnValue({ isPond: false, bedHeight: 170, centerT: 0, waterLevel: 150 }),
      getWaterLevelAt: vi.fn().mockReturnValue(0),
      getColumnTerrainData: vi.fn().mockReturnValue({
        adjustedHeight: 10,
        finalHeight: 10,
        localWaterLevel: 150,
        isDryLand: true,
        isPond: false,
        maxHeightOffset: 12,
        slope: 0
      })
    };

    const chunk = new Uint8Array(4096);
    const context: ChunkPipelineContext = {
      cx: 0, cy: 0, cz: 0,
      worldStartX: 0, worldStartY: 0, worldStartZ: 0,
      chunk,
      noise: mockNoise,
      terrainMap: [],
      biomeMap: [],
      generator: mockGenerator
    };

    pipeline.execute(context);

    // Bedrock at y = 0
    expect(chunk[0]).toBe(BLOCK_TYPES.STONE);
    // Biome filled blocks at y = 1..10
    expect(fillColumnSpy).toHaveBeenCalled();
    expect(chunk[1 * 256]).toBe(BLOCK_TYPES.GRASS);
    // Air at y > 10
    expect(chunk[11 * 256]).toBe(BLOCK_TYPES.AIR);
  });

  test('CaveCarverStage should carve cave tunnels to AIR', () => {
    const pipeline = new ChunkPipeline();
    pipeline.addStage(new TerrainHeightMapStage());
    pipeline.addStage(new BaseTerrainFillerStage());
    pipeline.addStage(new CaveCarverStage());

    const mockNoise = {
      noise: vi.fn().mockReturnValue(0.1),
      noise3d: vi.fn().mockReturnValue(0.01),
    } as unknown as ImprovedNoise;

    const mockBiome = {
      id: 'plains',
      name: '平原',
      fillColumn: (chunk: Uint8Array, lx: number, lz: number, y: number) => {
        chunk[lx + lz * 16 + (y % 16) * 256] = BLOCK_TYPES.STONE;
      },
    };

    const mockGenerator = {
      getPrimaryBiome: vi.fn().mockReturnValue(mockBiome),
      getRiverValue: vi.fn().mockReturnValue({ t: 0, bedHeight: 142, dRiver: 1.0, riverWeight: 1.0 }),
      getPondValue: vi.fn().mockReturnValue({ isPond: false, bedHeight: 170, centerT: 0, waterLevel: 150 }),
      getWaterLevelAt: vi.fn().mockReturnValue(0),
      isWaterArea: vi.fn().mockReturnValue(false),
      getColumnTerrainData: vi.fn().mockReturnValue({
        adjustedHeight: 45,
        finalHeight: 45,
        localWaterLevel: 150,
        isDryLand: true,
        isPond: false,
        maxHeightOffset: 12,
        slope: 0
      })
    };

    const chunk = new Uint8Array(4096);
    const context: ChunkPipelineContext = {
      cx: 0, cy: 1, cz: 0,
      worldStartX: 0, worldStartY: 16, worldStartZ: 0,
      chunk,
      noise: mockNoise,
      terrainMap: [],
      biomeMap: [],
      generator: mockGenerator
    };

    pipeline.execute(context);

    // Stone filled block at y = 28 (aligns with layerSpacing 28) should be carved to AIR (ly = 28 - 16 = 12)
    expect(chunk[12 * 256]).toBe(BLOCK_TYPES.AIR);
  });

  test('SurfaceDecorationStage should not generate floating vegetation on carved surface', () => {
    const pipeline = new ChunkPipeline();
    pipeline.addStage(new TerrainHeightMapStage());
    pipeline.addStage(new BaseTerrainFillerStage());
    pipeline.addStage(new CaveCarverStage());
    pipeline.addStage(new SurfaceDecorationStage());

    const mockNoise = {
      noise: vi.fn().mockReturnValue(0.4), // entranceNoise > 0.35
      noise3d: vi.fn().mockReturnValue(0.01), // triggers cave carving
    } as unknown as ImprovedNoise;

    const mockBiome = {
      id: 'plains',
      name: '平原',
      fillColumn: (chunk: Uint8Array, lx: number, lz: number, y: number) => {
        const index = lx + lz * 16 + (y % 16) * 256;
        chunk[index] = BLOCK_TYPES.GRASS;
      },
      getVegetationType: vi.fn().mockReturnValue(BLOCK_TYPES.TALL_GRASS),
    };

    const mockGenerator = {
      getPrimaryBiome: vi.fn().mockReturnValue(mockBiome),
      getRiverValue: vi.fn().mockReturnValue({ t: 0, bedHeight: 142, dRiver: 1.0, riverWeight: 1.0 }),
      getPondValue: vi.fn().mockReturnValue({ isPond: false, bedHeight: 170, centerT: 0, waterLevel: 150 }),
      getWaterLevelAt: vi.fn().mockReturnValue(0),
      getGroundBlockType: vi.fn().mockReturnValue(BLOCK_TYPES.GRASS),
      isWaterArea: vi.fn().mockReturnValue(false),
      getColumnTerrainData: vi.fn().mockReturnValue({
        adjustedHeight: 168,
        finalHeight: 168,
        localWaterLevel: 150,
        isDryLand: true,
        isPond: false,
        maxHeightOffset: -3,
        slope: 0
      })
    };

    const chunk = new Uint8Array(4096);
    const context: ChunkPipelineContext = {
      cx: 0, cy: 10, cz: 0,
      worldStartX: 0, worldStartY: 160, worldStartZ: 0,
      chunk,
      noise: mockNoise,
      terrainMap: [],
      biomeMap: [],
      generator: mockGenerator
    };

    pipeline.execute(context);

    // Ground block at y = 168 (index 8 * 256, aligns with layerSpacing) should be carved to AIR
    expect(chunk[8 * 256]).toBe(BLOCK_TYPES.AIR);
    // Vegetation at y = 169 (index 9 * 256) should NOT be TALL_GRASS (should be AIR) since ground is carved!
    expect(chunk[9 * 256]).toBe(BLOCK_TYPES.AIR);
  });

  test('TreeDecorationStage should run without error and respect biome growth probabilities', () => {
    const pipeline = new ChunkPipeline();
    pipeline.addStage(new TerrainHeightMapStage());
    pipeline.addStage(new BaseTerrainFillerStage());
    pipeline.addStage(new TreeDecorationStage());

    const mockNoise = {
      noise: vi.fn().mockReturnValue(0.1),
      noise3d: vi.fn().mockReturnValue(0.1),
      pseudoRandom2d: vi.fn().mockReturnValue(0.001), // triggers low random check (e.g. tree grows)
    } as unknown as ImprovedNoise;

    const mockBiome = {
      id: 'forest',
      name: '森林',
      fillColumn: (chunk: Uint8Array, lx: number, lz: number, y: number) => {
        const index = lx + lz * 16 + (y % 16) * 256;
        chunk[index] = BLOCK_TYPES.GRASS;
      },
      getTreeProbability: vi.fn().mockReturnValue(1.0),
    };

    const mockGenerator = {
      getPrimaryBiome: vi.fn().mockReturnValue(mockBiome),
      getRiverValue: vi.fn().mockReturnValue({ t: 0, bedHeight: 142, dRiver: 1.0, riverWeight: 1.0 }),
      getPondValue: vi.fn().mockReturnValue({ isPond: false, bedHeight: 170, centerT: 0, waterLevel: 150 }),
      getWaterLevelAt: vi.fn().mockReturnValue(0),
      getGroundBlockType: vi.fn().mockReturnValue(BLOCK_TYPES.GRASS),
      getColumnTerrainData: vi.fn().mockReturnValue({
        adjustedHeight: 160,
        finalHeight: 160,
        localWaterLevel: 150,
        isDryLand: true,
        isPond: false,
        maxHeightOffset: 12,
        slope: 0
      })
    };

    const chunk = new Uint8Array(4096);
    const context: ChunkPipelineContext = {
      cx: 0, cy: 10, cz: 0,
      worldStartX: 0, worldStartY: 160, worldStartZ: 0,
      chunk,
      noise: mockNoise,
      terrainMap: [],
      biomeMap: [],
      generator: mockGenerator
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).mockGrowDecorationsCalled = false;

    pipeline.execute(context);

    // It should invoke growDecorations on the biome (which sets mockGrowDecorationsCalled to true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).mockGrowDecorationsCalled).toBe(true);
  });

  test('OreGeneratorStage should replace STONE blocks with ores based on registration', () => {
    const pipeline = new ChunkPipeline();
    pipeline.addStage(new OreGeneratorStage());

    const mockNoise = {
      pseudoRandom3d: vi.fn().mockReturnValue(0.001), // triggers point ore generation
      noise3d: vi.fn().mockReturnValue(0.001),       // triggers vein ore generation
    } as unknown as ImprovedNoise;

    const mockBiome = {
      id: 'plains',
      name: '平原',
    };

    const chunk = new Uint8Array(4096);
    // y=0: Bedrock
    chunk[0] = BLOCK_TYPES.STONE;
    // y=1: Stone inside chunk
    chunk[1 * 256] = BLOCK_TYPES.STONE;
    // y=2: Grass
    chunk[2 * 256] = BLOCK_TYPES.GRASS;
    // y=3: Air
    chunk[3 * 256] = BLOCK_TYPES.AIR;

    const context: ChunkPipelineContext = {
      cx: 0, cy: 0, cz: 0,
      worldStartX: 0, worldStartY: 0, worldStartZ: 0,
      chunk,
      noise: mockNoise,
      terrainMap: [],
      biomeMap: Array.from({ length: 16 }, () => Array(16).fill(mockBiome)),
      generator: {}
    };

    pipeline.execute(context);

    // Bedrock should remain STONE
    expect(chunk[0]).toBe(BLOCK_TYPES.STONE);
    // Rock at y=1 should be replaced with ores
    expect(chunk[1 * 256]).not.toBe(BLOCK_TYPES.STONE);
    expect([BLOCK_TYPES.DIAMOND, BLOCK_TYPES.IRON, BLOCK_TYPES.COAL]).toContain(chunk[1 * 256]);
    // Other blocks remain unchanged
    expect(chunk[2 * 256]).toBe(BLOCK_TYPES.GRASS);
    expect(chunk[3 * 256]).toBe(BLOCK_TYPES.AIR);
  });

  test('isCaveAt should return false for heights above 200', () => {
    const mockNoise = {
      noise: vi.fn().mockReturnValue(0.1),
      noise3d: vi.fn().mockReturnValue(0.01),
    } as unknown as ImprovedNoise;

    const mockGenerator = {
      isWaterArea: vi.fn().mockReturnValue(false)
    };

    // Height 201 should return false regardless of noise
    const result = isCaveAt(0, 201, 0, 300, 12, 150, mockNoise, mockGenerator);
    expect(result).toBe(false);
  });
});
