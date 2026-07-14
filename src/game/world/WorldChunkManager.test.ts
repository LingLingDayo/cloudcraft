/* eslint-disable @typescript-eslint/no-explicit-any -- Allow explicit any in unit test worker mocks */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { World } from './World';
import { BLOCK_TYPES } from './BlockConfig';
import { CHUNK_STREAMING_CONFIG } from './streaming/ChunkStreamingConfig';
import { buildChunkVisibilitySummary } from './streaming/ChunkVisibilitySummary';
import type {
  GenerateChunkResult,
  GenerateMeshResult,
} from './worker/WorkerTypes';
import {
  assumeLiveWorkerPool,
  countTasks,
  createStreamingWorld,
  loadAllPotentialStreamingChunks,
  observeDeferredWorkerTasks,
  setLoadedChunk,
  TEST_CHUNK_BYTE_LENGTH,
} from './WorldChunkManagerTestUtils';

describe('WorldChunkManager Neighbor Mesh Re-indexing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should push loaded neighbors with existing meshes into pendingMeshQueue for updates', async () => {
    // Mock performance.now to bypass the time-slicing budget check during testing
    vi.spyOn(performance, 'now').mockReturnValue(0);

    // Create world with a test seed
    const world = new World('test-neighbor-culling');
    
    // We mock world.game to let processIncrementalLoading execute (it returns early if !world.game)
    world.game = {
      player: {
        position: { x: 0, y: 0, z: 0 }
      }
    };

    // Mock workerManager.execute to directly process generating mesh in main thread (simulating fallback)
    const { WorkerManager } = await import('./worker/WorkerManager');
    const { ChunkMeshBuilder } = await import('./ChunkMeshBuilder');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    vi.spyOn(workerManager, 'execute').mockImplementation(async (type, payload) => {
      if (type === 'GENERATE_MESH') {
        const { cx, cy, cz, chunk, neighbors, chunkRevision } = payload as any;
        return {
          mesh: ChunkMeshBuilder.buildMesh(cx, cy, cz, chunk, neighbors),
          summary: buildChunkVisibilitySummary(chunk, chunkRevision),
        } as any;
      }
      return null as any;
    });

    // Pre-populate chunk A (0,0,0) and chunk B (1,0,0) data
    const chunkA = world.generator.generateChunkData(0, 0, 0);
    const chunkB = world.generator.generateChunkData(1, 0, 0);
    world.chunks.set('0,0,0', chunkA);
    world.chunks.set('1,0,0', chunkB);

    // Mock chunk B to already have a mesh in renderer
    // This simulates that B was generated earlier
    const mockMesh = {
      geometry: { dispose: () => {} }
    } as any;
    
    world.getRenderer().getChunkMeshes().set('1,0,0', {
      solid: mockMesh,
      transparent: mockMesh,
      cutout: mockMesh
    });

    // Verify renderer reports B has a mesh, but A does not
    expect(world.getRenderer().hasChunkMesh('1,0,0')).toBe(true);
    expect(world.getRenderer().hasChunkMesh('0,0,0')).toBe(false);

    world.loadArea(0, 0, 0, 1);
    world.chunkManager.pendingMeshQueue = [];

    // Enqueue chunk A for mesh generation with updateNeighbors = true
    world.chunkManager.pendingMeshQueue.push({
      key: '0,0,0',
      updateNeighbors: true,
      epoch: world.chunkManager.getStreamingEpoch(),
      revision: world.getChunkRevision('0,0,0'),
    });

    // Process incremental loading (it will execute mesh generation for A)
    // In fallback mode, execute task is completed synchronously or resolved in a microtask
    world.chunkManager.processIncrementalLoading();

    // Since Web Workers fall back to synchronous resolve in test, we wait for promise resolutions
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify chunk A's mesh was generated
    expect(world.getRenderer().hasChunkMesh('0,0,0')).toBe(true);

    // Verify that B (1,0,0) was queued for mesh regeneration to cull boundary faces,
    // and its updateNeighbors is set to false to prevent infinite recursion
    const queuedB = world.chunkManager.pendingMeshQueue.find(item => item.key === '1,0,0');
    expect(queuedB).toBeDefined();
    expect(queuedB!.updateNeighbors).toBe(false);
  });

  test('does not cache a chunk generation result from an obsolete streaming epoch', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = new World('test-streaming-generation-epoch');
    world.game = {
      player: {
        position: { x: 0, y: 16, z: 0 },
      },
    };

    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let resolveGeneration!: (result: GenerateChunkResult) => void;
    const generationPromise = new Promise<GenerateChunkResult>((resolve) => {
      resolveGeneration = resolve;
    });
    vi.spyOn(workerManager, 'execute').mockImplementation((type) => {
      if (type === 'GENERATE_CHUNK') return generationPromise as any;
      return Promise.reject(new Error(`Unexpected worker task ${type}`));
    });

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();

    world.game.player.position.x = 64;
    world.loadArea(64, 16, 0, 0);
    const chunk = world.generator.generateChunkData(0, 1, 0);
    resolveGeneration({
      chunk,
      summary: buildChunkVisibilitySummary(chunk, world.getChunkRevision('0,1,0')),
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(world.chunks.has('0,1,0')).toBe(false);
  });

  test('does not mount a mesh result after its key leaves the active streaming epoch', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = new World('test-streaming-mesh-epoch');
    world.game = {
      player: {
        position: { x: 0, y: 16, z: 0 },
      },
    };
    world.chunks.set('0,1,0', world.generator.generateChunkData(0, 1, 0));

    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let resolveMesh!: (result: GenerateMeshResult) => void;
    const meshPromise = new Promise<GenerateMeshResult>((resolve) => {
      resolveMesh = resolve;
    });
    vi.spyOn(workerManager, 'execute').mockImplementation((type) => {
      if (type === 'GENERATE_MESH') return meshPromise as any;
      return Promise.reject(new Error(`Unexpected worker task ${type}`));
    });

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();

    world.game.player.position.x = 64;
    world.loadArea(64, 16, 0, 0);
    resolveMesh({
      mesh: { solid: null, transparent: null, cutout: null },
      summary: buildChunkVisibilitySummary(
        world.chunks.get('0,1,0')!,
        world.getChunkRevision('0,1,0'),
      ),
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(world.getRenderer().hasChunkMesh('0,1,0')).toBe(false);
  });
});

describe('WorldChunkManager worker concurrency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('limits chunk generation tasks scheduled by one incremental pass', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-generation-limit');
    const taskTypes = await observeDeferredWorkerTasks();

    world.loadArea(0, 16, 0, 1);
    world.chunkManager.processIncrementalLoading();

    expect(countTasks(taskTypes, 'GENERATE_CHUNK')).toBe(
      CHUNK_STREAMING_CONFIG.maxConcurrentGeneration,
    );
  });

  test('limits chunk mesh tasks scheduled by one incremental pass', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-mesh-limit');
    loadAllPotentialStreamingChunks(world);
    const taskTypes = await observeDeferredWorkerTasks();

    world.loadArea(0, 16, 0, 1);
    world.chunkManager.processIncrementalLoading();

    expect(countTasks(taskTypes, 'GENERATE_MESH')).toBe(
      CHUNK_STREAMING_CONFIG.maxConcurrentMeshing,
    );
  });

  test('continues generation while the mesh pool is saturated', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-mesh-fairness');
    setLoadedChunk(world, '0,1,0');
    setLoadedChunk(world, '1,1,0');
    setLoadedChunk(world, '-1,1,0');
    const taskTypes = await observeDeferredWorkerTasks();

    world.loadArea(0, 16, 0, 1);
    world.chunkManager.processIncrementalLoading();

    expect(countTasks(taskTypes, 'GENERATE_MESH')).toBe(
      CHUNK_STREAMING_CONFIG.maxConcurrentMeshing,
    );
    expect(countTasks(taskTypes, 'GENERATE_CHUNK')).toBeGreaterThan(0);
  });

  test('continues meshing while the generation pool is saturated', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-generation-fairness');
    const taskTypes = await observeDeferredWorkerTasks();

    world.loadArea(0, 16, 0, 1);
    world.chunkManager.processIncrementalLoading();
    expect(countTasks(taskTypes, 'GENERATE_CHUNK')).toBe(
      CHUNK_STREAMING_CONFIG.maxConcurrentGeneration,
    );

    setLoadedChunk(world, '0,2,0');
    world.chunkManager.invalidateVisibility();
    world.loadArea(0, 16, 0, 1);
    world.chunkManager.processIncrementalLoading();

    expect(countTasks(taskTypes, 'GENERATE_MESH')).toBeGreaterThan(0);
    expect(countTasks(taskTypes, 'GENERATE_CHUNK')).toBe(
      CHUNK_STREAMING_CONFIG.maxConcurrentGeneration,
    );
  });
});

describe('WorldChunkManager async result validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('does not mount a mesh result produced for an obsolete world seed', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-streaming-mesh-seed');
    setLoadedChunk(world, '0,1,0');

    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let resolveMesh!: (result: GenerateMeshResult) => void;
    const meshPromise = new Promise<GenerateMeshResult>((resolve) => {
      resolveMesh = resolve;
    });
    vi.spyOn(workerManager, 'execute').mockImplementation((type) => {
      if (type === 'GENERATE_MESH') return meshPromise as any;
      return new Promise(() => {}) as any;
    });
    let currentSeed = 'seed-before-mesh';
    vi.spyOn(world, 'getSeed').mockImplementation(() => currentSeed);
    const applyMeshResult = vi.spyOn(world.getRenderer(), 'applyMeshResult');

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    currentSeed = 'seed-after-mesh';
    resolveMesh({
      mesh: { solid: null, transparent: null, cutout: null },
      summary: buildChunkVisibilitySummary(
        world.chunks.get('0,1,0')!,
        world.getChunkRevision('0,1,0'),
      ),
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(applyMeshResult).not.toHaveBeenCalled();
  });

  test('queues generated modified chunks for meshing with their updated revision', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-generated-modification-revision');
    const key = '0,1,0';
    world.modifiedBlocks.set(key, new Map([['0,0,0', BLOCK_TYPES.STONE]]));

    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let resolveGeneration!: (result: GenerateChunkResult) => void;
    const generationPromise = new Promise<GenerateChunkResult>((resolve) => {
      resolveGeneration = resolve;
    });
    vi.spyOn(workerManager, 'execute').mockImplementation((type, payload) => {
      if (
        type === 'GENERATE_CHUNK'
        && payload.cx === 0
        && payload.cy === 1
        && payload.cz === 0
      ) {
        return generationPromise as any;
      }
      return new Promise(() => {}) as any;
    });

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    const chunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
    resolveGeneration({
      chunk,
      summary: buildChunkVisibilitySummary(chunk, world.getChunkRevision(key)),
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(world.getChunkRevision(key)).toBe(1);
    expect(world.getChunkVisibilitySummary(key)).toBeUndefined();
    expect(world.chunkManager.pendingMeshQueue.find(item => item.key === key)?.revision).toBe(1);
  });

  test('rejects a mesh and summary after saved modifications advance its revision', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-mesh-modification-race');
    const key = '0,1,0';
    setLoadedChunk(world, key);
    const staleSummary = buildChunkVisibilitySummary(
      world.chunks.get(key)!,
      world.getChunkRevision(key),
    );

    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let resolveMesh!: (result: GenerateMeshResult) => void;
    const meshPromise = new Promise<GenerateMeshResult>((resolve) => {
      resolveMesh = resolve;
    });
    vi.spyOn(workerManager, 'execute').mockImplementation((type) => {
      if (type === 'GENERATE_MESH') return meshPromise as any;
      return new Promise(() => {}) as any;
    });
    const applyMeshResult = vi.spyOn(world.getRenderer(), 'applyMeshResult');

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    world.modifiedBlocks.set(key, new Map([['0,0,0', BLOCK_TYPES.STONE]]));
    world.applyChunkModifications(key, world.chunks.get(key)!);
    resolveMesh({
      mesh: { solid: null, transparent: null, cutout: null },
      summary: staleSummary,
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(world.getChunkRevision(key)).toBe(1);
    expect(world.getChunkVisibilitySummary(key)).toBeUndefined();
    expect(applyMeshResult).not.toHaveBeenCalled();
  });

  test('does not cache generation completed after clearCache', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-generation-clear-cache');
    const key = '0,1,0';

    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let resolveGeneration!: (result: GenerateChunkResult) => void;
    const generationPromise = new Promise<GenerateChunkResult>((resolve) => {
      resolveGeneration = resolve;
    });
    vi.spyOn(workerManager, 'execute').mockImplementation((type, payload) => {
      if (
        type === 'GENERATE_CHUNK'
        && payload.cx === 0
        && payload.cy === 1
        && payload.cz === 0
      ) {
        return generationPromise as any;
      }
      return new Promise(() => {}) as any;
    });

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    world.chunkManager.clearCache();
    const chunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
    resolveGeneration({
      chunk,
      summary: buildChunkVisibilitySummary(chunk, world.getChunkRevision(key)),
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(world.chunks.has(key)).toBe(false);
  });
});
