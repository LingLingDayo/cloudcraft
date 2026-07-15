/* eslint-disable @typescript-eslint/no-explicit-any -- Worker test doubles require generic task payloads */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { BLOCK_TYPES } from './BlockConfig';
import { CHUNK_STREAMING_CONFIG } from './streaming/ChunkStreamingConfig';
import { buildChunkVisibilitySummary } from './streaming/ChunkVisibilitySummary';
import {
  ChunkVisibilityResolver,
  type ChunkStreamingView,
} from './streaming/ChunkVisibilityResolver';
import {
  assumeLiveWorkerPool,
  createStreamingWorld,
  setLoadedChunk,
  TEST_CHUNK_BYTE_LENGTH,
} from './WorldChunkManagerTestUtils';

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

  test.each([
    {
      axis: 'yaw',
      firstYawFactor: -0.49,
      firstPitchFactor: 0,
      secondYawFactor: 0.49,
      secondPitchFactor: 0,
      verticalFovRadians: Math.PI / 3,
      aspect: 16 / 9,
    },
    {
      axis: 'pitch',
      firstYawFactor: 0,
      firstPitchFactor: -0.49,
      secondYawFactor: 0,
      secondPitchFactor: 0.49,
      verticalFovRadians: Math.PI / 2.5,
      aspect: 4 / 3,
    },
  ])(
    'keeps exact $axis endpoint visibility inside the first radius-10 active set',
    async ({
      firstYawFactor,
      firstPitchFactor,
      secondYawFactor,
      secondPitchFactor,
      verticalFovRadians,
      aspect,
    }) => {
      const world = createStreamingWorld('test-direction-bucket-uncertainty');
      const { WorkerManager } = await import('./worker/WorkerManager');
      assumeLiveWorkerPool(WorkerManager.getInstance());
      const managerResolver = (world.chunkManager as any).visibilityResolver;
      const resolve = vi.spyOn(managerResolver, 'resolve');
      const directionStep = Math.PI * 2 / CHUNK_STREAMING_CONFIG.directionQuantizationSteps;
      const view: ChunkStreamingView = {
        position: { x: 8, y: 136, z: 8 },
        forward: { x: 0, y: 0, z: 1 },
        verticalFovRadians,
        aspect,
      };
      const setDirection = (yaw: number, pitch: number): void => {
        const horizontalScale = Math.cos(pitch);
        (view.forward as { x: number }).x = Math.sin(yaw) * horizontalScale;
        (view.forward as { y: number }).y = Math.sin(pitch);
        (view.forward as { z: number }).z = Math.cos(yaw) * horizontalScale;
      };

      setDirection(firstYawFactor * directionStep, firstPitchFactor * directionStep);
      world.loadArea(view.position.x, view.position.y, view.position.z, 10, false, view);
      const firstActive = new Set<string>((world.chunkManager as any).desiredActiveKeys);

      setDirection(secondYawFactor * directionStep, secondPitchFactor * directionStep);
      world.loadArea(view.position.x, view.position.y, view.position.z, 10, false, view);
      const exactVisibility = new ChunkVisibilityResolver().resolve({
        center: { x: 0, y: 8, z: 0 },
        radius: 10,
        minChunkY: 0,
        maxChunkYExclusive: 32,
        view,
        positionUncertaintyRadius: 0,
        getChunkState: key => world.getChunkVisibilityState(key),
      });
      const missing = [...exactVisibility.directVisible].filter(key => !firstActive.has(key));

      expect(missing).toEqual([]);
      expect(resolve).toHaveBeenCalledTimes(1);
    },
  );

  test('re-resolves after crossing a direction bucket boundary', async () => {
    const world = createStreamingWorld('test-direction-bucket-crossing');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const resolver = (world.chunkManager as any).visibilityResolver;
    const resolve = vi.spyOn(resolver, 'resolve');
    const directionStep = Math.PI * 2 / CHUNK_STREAMING_CONFIG.directionQuantizationSteps;
    const view: ChunkStreamingView = {
      position: { x: 8, y: 136, z: 8 },
      forward: { x: 0, y: 0, z: 1 },
      verticalFovRadians: Math.PI / 3,
      aspect: 16 / 9,
    };

    (view.forward as { x: number }).x = Math.sin(0.49 * directionStep);
    (view.forward as { z: number }).z = Math.cos(0.49 * directionStep);
    world.loadArea(view.position.x, view.position.y, view.position.z, 10, false, view);
    (view.forward as { x: number }).x = Math.sin(0.51 * directionStep);
    (view.forward as { z: number }).z = Math.cos(0.51 * directionStep);
    world.loadArea(view.position.x, view.position.y, view.position.z, 10, false, view);

    expect(resolve).toHaveBeenCalledTimes(2);
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

  test('advances an unknown frontier only after transparent summaries without restarting the epoch', async () => {
    const world = createStreamingWorld('test-progressive-transparent-frontier');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const transparentChunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);

    world.loadArea(0, 16, 0, 4);
    const initialActive = new Set<string>((world.chunkManager as any).desiredActiveKeys);
    const epoch = world.chunkManager.getStreamingEpoch();

    expect(initialActive.has('1,1,0')).toBe(true);
    expect(initialActive.has('2,1,0')).toBe(false);

    world.applyChunkVisibilitySummary(
      '0,1,0',
      buildChunkVisibilitySummary(transparentChunk, world.getChunkRevision('0,1,0')),
    );
    world.loadArea(0, 16, 0, 4);
    const centerExpandedActive = new Set<string>((world.chunkManager as any).desiredActiveKeys);

    expect(centerExpandedActive.has('2,1,0')).toBe(true);
    expect(centerExpandedActive.has('3,1,0')).toBe(false);
    expect(world.chunkManager.getStreamingEpoch()).toBe(epoch);

    world.applyChunkVisibilitySummary(
      '1,1,0',
      buildChunkVisibilitySummary(transparentChunk, world.getChunkRevision('1,1,0')),
    );
    world.loadArea(0, 16, 0, 4);
    const portalExpandedActive = new Set<string>((world.chunkManager as any).desiredActiveKeys);

    expect(portalExpandedActive.has('3,1,0')).toBe(true);
    expect(portalExpandedActive.has('4,1,0')).toBe(false);
    expect(world.chunkManager.getStreamingEpoch()).toBe(epoch);
  });

  test('keeps loaded chunks active while a block edit waits for its new visibility summary', async () => {
    const world = createStreamingWorld('test-block-edit-stable-active-set');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const transparentChunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
    const opaqueChunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
    for (let index = 0; index < opaqueChunk.length; index += 2) {
      opaqueChunk[index] = BLOCK_TYPES.STONE;
    }
    for (const [key, chunk] of [
      ['0,1,0', transparentChunk],
      ['1,1,0', transparentChunk.slice()],
      ['2,1,0', opaqueChunk],
    ] as const) {
      world.chunks.set(key, chunk);
      world.applyChunkVisibilitySummary(
        key,
        buildChunkVisibilitySummary(chunk, world.getChunkRevision(key)),
      );
    }
    world.loadArea(0, 16, 0, 4);
    const activeBeforeEdit = new Set<string>((world.chunkManager as any).desiredActiveKeys);
    const epochBeforeEdit = world.chunkManager.getStreamingEpoch();
    const distantKey = '3,1,0';
    const renderer = world.getRenderer();
    const removeChunkMesh = vi.spyOn(renderer, 'removeChunkMesh').mockImplementation(() => {});
    renderer.getChunkMeshes().set(distantKey, {} as any);
    vi.spyOn(world, 'recalculateColumnSkyLight').mockImplementation(() => {});
    vi.spyOn(world, 'notifyNeighborsOfStateChange').mockImplementation(() => {});
    vi.spyOn(world, 'updateChunkMeshAsync').mockImplementation(() => {});

    world.setBlock(0, 16, 0, BLOCK_TYPES.STONE);
    world.loadArea(0, 16, 0, 4);

    expect(new Set<string>((world.chunkManager as any).desiredActiveKeys)).toEqual(activeBeforeEdit);
    expect(world.chunkManager.getStreamingEpoch()).toBe(epochBeforeEdit);
    expect(removeChunkMesh).not.toHaveBeenCalledWith(distantKey);
    expect(world.getChunkVisibilitySummary('0,1,0')).toBeUndefined();
    expect(world.getChunkVisibilityState('0,1,0').fallbackSummary?.chunkRevision).toBe(0);

    const currentChunk = world.chunks.get('0,1,0')!;
    world.applyChunkVisibilitySummary(
      '0,1,0',
      buildChunkVisibilitySummary(currentChunk, world.getChunkRevision('0,1,0')),
    );
    world.loadArea(0, 16, 0, 4);

    expect(new Set<string>((world.chunkManager as any).desiredActiveKeys)).toEqual(activeBeforeEdit);
    expect(world.getChunkVisibilitySummary('0,1,0')?.chunkRevision).toBe(1);
    expect(world.getChunkVisibilityState('0,1,0').fallbackSummary).toBeUndefined();
  });

  test('keeps radius-resident meshes when the camera turns in place', async () => {
    const world = createStreamingWorld('test-turn-retains-radius-meshes');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const transparentChunk = new Uint8Array(TEST_CHUNK_BYTE_LENGTH);
    const lookForward: ChunkStreamingView = {
      position: { x: 8, y: 24, z: 8 },
      forward: { x: 0, y: 0, z: 1 },
      verticalFovRadians: Math.PI / 3,
      aspect: 1,
    };
    const lookBackward: ChunkStreamingView = {
      position: { x: 8, y: 24, z: 8 },
      forward: { x: 0, y: 0, z: -1 },
      verticalFovRadians: Math.PI / 3,
      aspect: 1,
    };

    // Distance 3 is outside always-available + safety buffer when facing the opposite way.
    const retainedKey = '0,1,3';
    for (const key of ['0,1,0', '0,1,1', '0,1,2', retainedKey]) {
      world.chunks.set(key, transparentChunk.slice());
      world.applyChunkVisibilitySummary(
        key,
        buildChunkVisibilitySummary(transparentChunk, world.getChunkRevision(key)),
      );
    }

    world.loadArea(8, 24, 8, 4, false, lookForward);
    const epochBeforeTurn = world.chunkManager.getStreamingEpoch();
    expect((world.chunkManager as any).desiredActiveKeys.has(retainedKey)).toBe(true);

    const renderer = world.getRenderer();
    const removeChunkMesh = vi.spyOn(renderer, 'removeChunkMesh').mockImplementation(() => {
      renderer.getChunkMeshes().delete(retainedKey);
    });
    renderer.getChunkMeshes().set(retainedKey, {} as any);
    renderer.getChunkMeshes().set('0,1,0', {} as any);

    world.loadArea(8, 24, 8, 4, false, lookBackward);

    expect((world.chunkManager as any).desiredActiveKeys.has(retainedKey)).toBe(false);
    expect(world.chunkManager.isKeyActive(retainedKey)).toBe(true);
    expect(world.chunkManager.getStreamingEpoch()).toBe(epochBeforeTurn);
    expect(removeChunkMesh).not.toHaveBeenCalledWith(retainedKey);
    expect(renderer.hasChunkMesh(retainedKey)).toBe(true);
  });

  test('accepts safety-buffer streaming keys just outside the strict render radius', async () => {
    const world = createStreamingWorld('test-safety-buffer-within-retain-radius');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const view: ChunkStreamingView = {
      position: { x: 8, y: 24, z: 8 },
      forward: { x: 0, y: 0, z: 1 },
      verticalFovRadians: Math.PI / 3,
      aspect: 1,
    };

    world.loadArea(8, 24, 8, 2, false, view);
    // Chebyshev/sphere distance 3 is outside strict radius 2 but inside retain radius 3.
    const bufferKey = '0,1,3';
    (world.chunkManager as any).desiredActiveKeys.add(bufferKey);

    expect(world.chunkManager.isKeyActive(bufferKey)).toBe(true);
    expect((world.chunkManager as any).isWithinRetainRadius(bufferKey)).toBe(true);
    expect((world.chunkManager as any).isTaskCurrent(
      bufferKey,
      world.chunkManager.getStreamingEpoch(),
      world.getChunkRevision(bufferKey),
      world.getSeed(),
    )).toBe(true);
  });

  test('unloads meshes that leave the load-radius sphere after the player moves', async () => {
    const world = createStreamingWorld('test-move-unloads-outside-radius');
    const { WorkerManager } = await import('./worker/WorkerManager');
    assumeLiveWorkerPool(WorkerManager.getInstance());
    const view: ChunkStreamingView = {
      position: { x: 8, y: 24, z: 8 },
      forward: { x: 0, y: 0, z: 1 },
      verticalFovRadians: Math.PI / 3,
      aspect: 1,
    };

    world.loadArea(8, 24, 8, 2, false, view);
    const farKey = '0,1,8';
    const renderer = world.getRenderer();
    const removeChunkMesh = vi.spyOn(renderer, 'removeChunkMesh').mockImplementation((key: string) => {
      renderer.getChunkMeshes().delete(key);
    });
    renderer.getChunkMeshes().set(farKey, {} as any);
    renderer.getChunkMeshes().set('0,1,0', {} as any);

    world.chunkManager.invalidateVisibility();
    world.loadArea(8 + 16 * 6, 24, 8, 2, false, {
      ...view,
      position: { x: 8 + 16 * 6, y: 24, z: 8 },
    });

    expect(removeChunkMesh).toHaveBeenCalledWith(farKey);
    expect(renderer.hasChunkMesh(farKey)).toBe(false);
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
