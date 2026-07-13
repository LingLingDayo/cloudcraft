import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  assumeLiveWorkerPool,
  createStreamingWorld,
  setLoadedChunk,
} from './WorldChunkManagerTestUtils';

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
