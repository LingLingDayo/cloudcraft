/* eslint-disable @typescript-eslint/no-explicit-any -- Worker test doubles require generic task payloads */
import { vi } from 'vitest';
import { World } from './World';
import { CHUNK_STREAMING_CONFIG } from './streaming/ChunkStreamingConfig';
import type { WorkerTaskType } from './worker/WorkerTypes';

export const TEST_CHUNK_BYTE_LENGTH = 16 * 16 * 16 * 2;

export function createStreamingWorld(seed: string): World {
  const world = new World(seed);
  world.game = {
    player: {
      position: { x: 0, y: 16, z: 0 },
    },
  };
  return world;
}

export function setLoadedChunk(world: World, key: string): void {
  world.chunks.set(key, new Uint8Array(TEST_CHUNK_BYTE_LENGTH));
}

export function loadAllPotentialStreamingChunks(world: World): void {
  for (let x = -2; x <= 2; x++) {
    for (let y = 0; y <= 3; y++) {
      for (let z = -2; z <= 2; z++) {
        setLoadedChunk(world, `${x},${y},${z}`);
      }
    }
  }
}

export function assumeLiveWorkerPool(workerManager: object): void {
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

export async function observeDeferredWorkerTasks(): Promise<WorkerTaskType[]> {
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

export function countTasks(
  taskTypes: readonly WorkerTaskType[],
  type: WorkerTaskType,
): number {
  return taskTypes.filter(taskType => taskType === type).length;
}

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
