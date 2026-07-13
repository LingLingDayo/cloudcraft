/* eslint-disable @typescript-eslint/no-explicit-any -- Allow explicit any in unit test mocks to override WorkerManager execution */
import { vi, describe, test, expect, afterEach } from 'vitest';
import { World } from './World';
import { BLOCK_TYPES } from './BlockConfig';
import { CHUNK_STREAMING_CONFIG } from './streaming/ChunkStreamingConfig';
import { buildChunkVisibilitySummary } from './streaming/ChunkVisibilitySummary';
import {
  ChunkVisibilityResolver,
  type ChunkStreamingView,
} from './streaming/ChunkVisibilityResolver';
import type {
  GenerateChunkResult,
  GenerateMeshResult,
  WorkerTaskType,
} from './worker/WorkerTypes';

const TEST_CHUNK_BYTE_LENGTH = 16 * 16 * 16 * 2;

function createStreamingWorld(seed: string): World {
  const world = new World(seed);
  world.game = {
    player: {
      position: { x: 0, y: 16, z: 0 },
    },
  };
  return world;
}

function setLoadedChunk(world: World, key: string): void {
  world.chunks.set(key, new Uint8Array(TEST_CHUNK_BYTE_LENGTH));
}

function loadAllPotentialStreamingChunks(world: World): void {
  for (let x = -2; x <= 2; x++) {
    for (let y = 0; y <= 3; y++) {
      for (let z = -2; z <= 2; z++) {
        setLoadedChunk(world, `${x},${y},${z}`);
      }
    }
  }
}

function assumeLiveWorkerPool(workerManager: object): void {
  const manager = workerManager as {
    hasLiveWorkers?: () => boolean;
    getIdleWorkerCount?: () => number;
  };
  if (typeof manager.hasLiveWorkers !== 'function') return;
  vi.spyOn(manager as { hasLiveWorkers: () => boolean }, 'hasLiveWorkers').mockReturnValue(true);
  if (typeof manager.getIdleWorkerCount === 'function') {
    vi.spyOn(
      manager as { getIdleWorkerCount: () => number },
      'getIdleWorkerCount',
    ).mockReturnValue(
      CHUNK_STREAMING_CONFIG.maxConcurrentGeneration
      + CHUNK_STREAMING_CONFIG.maxConcurrentMeshing,
    );
  }
}

async function observeDeferredWorkerTasks(): Promise<WorkerTaskType[]> {
  const { WorkerManager } = await import('./worker/WorkerManager');
  const taskTypes: WorkerTaskType[] = [];
  const workerManager = WorkerManager.getInstance();
  assumeLiveWorkerPool(workerManager);
  vi.spyOn(workerManager, 'execute').mockImplementation(((type: WorkerTaskType) => {
    taskTypes.push(type);
    return new Promise(() => {});
  }) as any);
  return taskTypes;
}

function countTasks(taskTypes: readonly WorkerTaskType[], type: WorkerTaskType): number {
  return taskTypes.filter(taskType => taskType === type).length;
}

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

    setLoadedChunk(world, '2,1,0');
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

describe('WorldChunkManager visibility cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('treats equivalent directions across the yaw wrap as one quantized view', async () => {
    const world = createStreamingWorld('test-streaming-yaw-wrap');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const resolver = (world.chunkManager as any).visibilityResolver;
    const resolve = vi.spyOn(resolver, 'resolve');
    const view: ChunkStreamingView = {
      position: { x: 0, y: 16, z: 0 },
      forward: { x: 0.000_001, y: 0, z: -1 },
      verticalFovRadians: Math.PI / 3,
      aspect: 1,
    };

    world.loadArea(0, 16, 0, 1, false, view);
    (view.forward as { x: number }).x = -0.000_001;
    world.loadArea(0, 16, 0, 1, false, view);

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  test('does not advance the epoch when summary invalidation keeps the active set unchanged', () => {
    const world = createStreamingWorld('test-streaming-stable-active-set');
    setLoadedChunk(world, '0,1,0');
    world.loadArea(0, 16, 0, 0);
    const epoch = world.chunkManager.getStreamingEpoch();

    world.applyChunkVisibilitySummary(
      '0,1,0',
      buildChunkVisibilitySummary(
        world.chunks.get('0,1,0')!,
        world.getChunkRevision('0,1,0'),
      ),
    );
    world.loadArea(0, 16, 0, 0);

    expect(world.chunkManager.getStreamingEpoch()).toBe(epoch);
  });
});

describe('WorldChunkManager worker capability fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('reports an empty live worker pool when every Worker constructor fails', async () => {
    const { WorkerManager } = await import('./worker/WorkerManager');
    WorkerManager.getInstance().dispose();
    vi.stubGlobal('Worker', class FailingWorker {
      public constructor() {
        throw new Error('worker construction failed');
      }
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const workerManager = WorkerManager.getInstance();

    try {
      expect(
        (workerManager as unknown as { hasLiveWorkers(): boolean }).hasLiveWorkers(),
      ).toBe(false);
    } finally {
      workerManager.dispose();
    }
  });

  test('uses synchronous loading and meshing when the live worker pool is empty', async () => {
    const { WorkerManager } = await import('./worker/WorkerManager');
    WorkerManager.getInstance().dispose();
    vi.stubGlobal('Worker', class FailingWorker {
      public constructor() {
        throw new Error('worker construction failed');
      }
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const workerManager = WorkerManager.getInstance();
    const world = createStreamingWorld('test-empty-worker-pool-fallback');
    const updateChunkMesh = vi.spyOn(world, 'updateChunkMesh').mockImplementation(() => {});

    try {
      world.loadArea(0, 16, 0, 0);
      const loadedSynchronously = world.chunks.has('0,1,0');
      if (!loadedSynchronously) setLoadedChunk(world, '0,1,0');
      updateChunkMesh.mockClear();

      world.updateChunkMeshAsync(0, 1, 0);

      expect(loadedSynchronously).toBe(true);
      expect(updateChunkMesh).toHaveBeenCalledWith(0, 1, 0, false);
    } finally {
      workerManager.dispose();
    }
  });
});

describe('WorldChunkManager worker retries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('retries failed generation on a later incremental pass and eventually succeeds', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-generation-retry');
    const key = '0,1,0';
    const chunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let centerAttempts = 0;
    vi.spyOn(workerManager, 'execute').mockImplementation((type, payload) => {
      if (
        type === 'GENERATE_CHUNK'
        && payload.cx === 0
        && payload.cy === 1
        && payload.cz === 0
      ) {
        centerAttempts++;
        if (centerAttempts === 1) return Promise.reject(new Error('transient generation failure'));
        return Promise.resolve({
          chunk,
          summary: buildChunkVisibilitySummary(chunk, world.getChunkRevision(key)),
        }) as any;
      }
      return new Promise(() => {}) as any;
    });

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(world.chunks.has(key)).toBe(false);

    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(centerAttempts).toBe(2);
    expect(world.chunks.has(key)).toBe(true);
  });

  test('retries failed meshing on a later incremental pass and eventually mounts', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-mesh-retry');
    const key = '0,1,0';
    setLoadedChunk(world, key);
    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let centerAttempts = 0;
    vi.spyOn(workerManager, 'execute').mockImplementation((type, payload) => {
      if (
        type === 'GENERATE_MESH'
        && payload.cx === 0
        && payload.cy === 1
        && payload.cz === 0
      ) {
        centerAttempts++;
        if (centerAttempts === 1) return Promise.reject(new Error('transient mesh failure'));
        return Promise.resolve({
          mesh: { solid: null, transparent: null, cutout: null },
          summary: buildChunkVisibilitySummary(
            world.chunks.get(key)!,
            world.getChunkRevision(key),
          ),
        }) as any;
      }
      return new Promise(() => {}) as any;
    });
    const applyMeshResult = vi.spyOn(world.getRenderer(), 'applyMeshResult');

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(applyMeshResult).not.toHaveBeenCalled();

    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(centerAttempts).toBe(2);
    expect(applyMeshResult).toHaveBeenCalledTimes(1);
  });

  test('stops at the configured retry limit without retrying again in the same or later frame', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-generation-retry-limit');
    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let centerAttempts = 0;
    vi.spyOn(workerManager, 'execute').mockImplementation((type, payload) => {
      if (
        type === 'GENERATE_CHUNK'
        && payload.cx === 0
        && payload.cy === 1
        && payload.cz === 0
      ) {
        centerAttempts++;
        return Promise.reject(new Error(`generation failure ${centerAttempts}`));
      }
      return new Promise(() => {}) as any;
    });
    const retryLimit = (
      CHUNK_STREAMING_CONFIG as typeof CHUNK_STREAMING_CONFIG & {
        maxWorkerTaskAttempts?: number;
      }
    ).maxWorkerTaskAttempts;

    expect(retryLimit).toBe(3);
    for (let attempt = 0; attempt < 3; attempt++) {
      world.loadArea(0, 16, 0, 0);
      world.chunkManager.processIncrementalLoading();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(centerAttempts).toBe(3);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('failed after 3 attempts'),
      expect.any(Error),
    );
  });

  test('does not retry or log a cancelled worker task', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-cancelled-generation-no-retry');
    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cancellation = new Error('cancelled queued task');
    cancellation.name = 'WorkerTaskCancelledError';
    let centerAttempts = 0;
    vi.spyOn(workerManager, 'execute').mockImplementation((type, payload) => {
      if (
        type === 'GENERATE_CHUNK'
        && payload.cx === 0
        && payload.cy === 1
        && payload.cz === 0
      ) {
        centerAttempts++;
        return Promise.reject(cancellation);
      }
      return new Promise(() => {}) as any;
    });

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));
    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(centerAttempts).toBe(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('clears failed retry state when clearCache starts a new epoch', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const world = createStreamingWorld('test-generation-retry-clear-cache');
    const key = '0,1,0';
    const chunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    let centerAttempts = 0;
    vi.spyOn(workerManager, 'execute').mockImplementation((type, payload) => {
      if (
        type === 'GENERATE_CHUNK'
        && payload.cx === 0
        && payload.cy === 1
        && payload.cz === 0
      ) {
        centerAttempts++;
        if (centerAttempts === 1) return Promise.reject(new Error('failure before clear'));
        return Promise.resolve({
          chunk,
          summary: buildChunkVisibilitySummary(chunk, world.getChunkRevision(key)),
        }) as any;
      }
      return new Promise(() => {}) as any;
    });

    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));
    world.chunkManager.clearCache();
    world.loadArea(0, 16, 0, 0);
    world.chunkManager.processIncrementalLoading();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(centerAttempts).toBe(2);
    expect(world.chunks.has(key)).toBe(true);
  });
});

describe('WorldChunkManager local camera position cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('re-resolves a default view after crossing position buckets inside one chunk', async () => {
    const world = createStreamingWorld('test-position-bucket-crossing');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const resolver = (world.chunkManager as any).visibilityResolver;
    const resolve = vi.spyOn(resolver, 'resolve');
    const view = {
      position: { x: 0.25, y: 16.25, z: 0.25 },
      forward: { x: 0, y: 0, z: -1 },
      verticalFovRadians: Math.PI / 3,
      aspect: 16 / 9,
    } satisfies ChunkStreamingView;

    world.loadArea(view.position.x, view.position.y, view.position.z, 4, false, view);
    view.position.x = 15.75;
    view.position.y = 31.75;
    view.position.z = 15.75;
    world.loadArea(view.position.x, view.position.y, view.position.z, 4, false, view);

    expect(resolve).toHaveBeenCalledTimes(2);
  });

  test('keeps exact visibility inside the first active set for every sampled position in one bucket', async () => {
    const world = createStreamingWorld('test-position-bucket-uncertainty');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const managerResolver = (world.chunkManager as any).visibilityResolver;
    const resolve = vi.spyOn(managerResolver, 'resolve');
    const bucketSize = (
      CHUNK_STREAMING_CONFIG as typeof CHUNK_STREAMING_CONFIG & {
        viewPositionBucketSizeBlocks?: number;
      }
    ).viewPositionBucketSizeBlocks ?? 4;
    const bucketMinimum = { x: bucketSize, y: 4 * bucketSize, z: bucketSize };
    const sampleOffsetMinimum = 0.01;
    const sampleOffsetMaximum = bucketSize - sampleOffsetMinimum;
    const view = {
      position: {
        x: bucketMinimum.x + sampleOffsetMinimum,
        y: bucketMinimum.y + sampleOffsetMinimum,
        z: bucketMinimum.z + sampleOffsetMinimum,
      },
      forward: { x: 0, y: 0, z: -1 },
      verticalFovRadians: Math.PI / 3,
      aspect: 16 / 9,
    } satisfies ChunkStreamingView;

    expect(bucketSize).toBe(4);
    world.loadArea(view.position.x, view.position.y, view.position.z, 4, false, view);
    const firstActive = new Set<string>((world.chunkManager as any).desiredActiveKeys);
    const exactResolver = new ChunkVisibilityResolver();

    for (const offsetX of [sampleOffsetMinimum, sampleOffsetMaximum]) {
      for (const offsetY of [sampleOffsetMinimum, sampleOffsetMaximum]) {
        for (const offsetZ of [sampleOffsetMinimum, sampleOffsetMaximum]) {
          view.position.x = bucketMinimum.x + offsetX;
          view.position.y = bucketMinimum.y + offsetY;
          view.position.z = bucketMinimum.z + offsetZ;
          world.loadArea(view.position.x, view.position.y, view.position.z, 4, false, view);
          const exactVisibility = exactResolver.resolve({
            center: {
              x: Math.floor(view.position.x / 16),
              y: Math.floor(view.position.y / 16),
              z: Math.floor(view.position.z / 16),
            },
            radius: 4,
            minChunkY: 0,
            maxChunkYExclusive: 32,
            view,
            positionUncertaintyRadius: 0,
            getChunkState: key => world.getChunkVisibilityState(key),
          });
          const missing = [...exactVisibility.directVisible].filter(key => !firstActive.has(key));
          expect(missing).toEqual([]);
        }
      }
    }

    expect(resolve).toHaveBeenCalledTimes(1);
  });
});

describe('WorldChunkManager worker queue ownership', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('submits only into real idle slots and leaves obsolete active work to finish', async () => {
    const { WorkerManager } = await import('./worker/WorkerManager');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    WorkerManager.getInstance().dispose();

    class SingleSlotWorker {
      public static instance: SingleSlotWorker | null = null;
      public onmessage: ((event: MessageEvent<any>) => void) | null = null;
      public onerror: ((event: ErrorEvent) => void) | null = null;
      public readonly postedTasks: any[] = [];
      private completedTaskCount = 0;

      public constructor() {
        SingleSlotWorker.instance = this;
      }

      public postMessage(task: any): void {
        this.postedTasks.push(task);
      }

      public terminate(): void {}

      public completeNext(): void {
        const task = this.postedTasks[this.completedTaskCount++];
        const chunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
        this.onmessage?.({
          data: {
            id: task.id,
            type: task.type,
            success: true,
            payload: {
              chunk,
              summary: buildChunkVisibilitySummary(chunk, task.payload.chunkRevision),
            },
          },
        } as MessageEvent<any>);
      }
    }

    vi.stubGlobal('Worker', SingleSlotWorker);
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(1);
    const workerManager = WorkerManager.getInstance();
    const world = createStreamingWorld('test-manager-worker-owner');

    try {
      world.loadArea(0, 16, 0, 0);
      world.chunkManager.processIncrementalLoading();
      const queueAfterFirstPass = workerManager.getQueueLength();

      world.chunkManager.clearCache();
      world.game.player.position.x = 64;
      world.loadArea(64, 16, 0, 0);
      world.chunkManager.processIncrementalLoading();
      const queueAfterClear = workerManager.getQueueLength();

      SingleSlotWorker.instance!.completeNext();
      await new Promise(resolve => setTimeout(resolve, 0));
      world.chunkManager.processIncrementalLoading();

      expect(queueAfterFirstPass).toBe(0);
      expect(queueAfterClear).toBe(0);
      expect(SingleSlotWorker.instance!.postedTasks).toHaveLength(2);
      expect(SingleSlotWorker.instance!.postedTasks[1].payload.cx).toBe(4);
    } finally {
      workerManager.dispose();
    }
  });
});

describe('World direct mesh cancellation logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('does not log a cancelled direct mesh task', async () => {
    const world = createStreamingWorld('test-direct-mesh-cancel-log');
    const key = '0,1,0';
    setLoadedChunk(world, key);
    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    world.loadArea(0, 16, 0, 0);
    const cancellation = new Error('superseded direct mesh');
    cancellation.name = 'WorkerTaskCancelledError';
    vi.spyOn(workerManager, 'execute').mockRejectedValue(cancellation);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    world.updateChunkMeshAsync(0, 1, 0);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleError).not.toHaveBeenCalled();
  });

  test('continues to log a real direct mesh failure', async () => {
    const world = createStreamingWorld('test-direct-mesh-error-log');
    const key = '0,1,0';
    setLoadedChunk(world, key);
    const { WorkerManager } = await import('./worker/WorkerManager');
    const workerManager = WorkerManager.getInstance();
    assumeLiveWorkerPool(workerManager);
    world.loadArea(0, 16, 0, 0);
    const failure = new Error('real direct mesh failure');
    vi.spyOn(workerManager, 'execute').mockRejectedValue(failure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    world.updateChunkMeshAsync(0, 1, 0);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleError).toHaveBeenCalledWith(
      `Failed to generate mesh asynchronously for chunk ${key}`,
      failure,
    );
  });
});
