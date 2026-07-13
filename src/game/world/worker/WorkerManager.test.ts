import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { buildChunkVisibilitySummary } from '../streaming/ChunkVisibilitySummary';
import {
  isWorkerTaskCancelledError,
  WorkerManager,
} from './WorkerManager';
import type {
  GenerateChunkPayload,
  GenerateChunkResult,
  GenerateMeshPayload,
  GenerateMeshResult,
  WorkerResult,
  WorkerTask,
} from './WorkerTypes';

interface TestWorkerTaskMetadata {
  readonly owner: string;
  readonly key: string;
  readonly epoch: number;
  readonly revision: number;
  readonly seed: string;
}

interface QueueAwareWorkerManager {
  execute(
    type: 'GENERATE_CHUNK',
    payload: GenerateChunkPayload,
    options: { readonly metadata: TestWorkerTaskMetadata },
  ): Promise<GenerateChunkResult>;
  execute(
    type: 'GENERATE_MESH',
    payload: GenerateMeshPayload,
    options: { readonly metadata: TestWorkerTaskMetadata },
  ): Promise<GenerateMeshResult>;
  cancelQueuedTasks(
    owner: string,
    shouldCancel?: (metadata: TestWorkerTaskMetadata) => boolean,
  ): number;
  getQueueLength(): number;
}

class FakeWorker {
  public static instances: FakeWorker[] = [];
  public static failConstruction = false;

  public onmessage: ((event: MessageEvent<WorkerResult>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public readonly postedTasks: WorkerTask[] = [];
  public terminated = false;
  private completedTaskCount = 0;

  public constructor() {
    if (FakeWorker.failConstruction) throw new Error('worker reconstruction failed');
    FakeWorker.instances.push(this);
  }

  public postMessage(task: WorkerTask): void {
    this.postedTasks.push(task);
  }

  public terminate(): void {
    this.terminated = true;
  }

  public completeNext(result: GenerateChunkResult): void {
    const task = this.postedTasks[this.completedTaskCount++];
    if (!task) throw new Error('No posted task is available to complete');
    this.onmessage?.({
      data: {
        id: task.id,
        type: task.type,
        success: true,
        payload: result,
      },
    } as MessageEvent<WorkerResult>);
  }

  public emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const TEST_CHUNK = new Uint8Array(16 * 16 * 16 * 2);
const TEST_RESULT: GenerateChunkResult = {
  chunk: TEST_CHUNK,
  summary: buildChunkVisibilitySummary(TEST_CHUNK, 0),
};

function payload(cx: number): GenerateChunkPayload {
  return { cx, cy: 0, cz: 0, seed: 'test-worker-queue', chunkRevision: 0 };
}

function metadata(
  key: string,
  epoch: number,
  revision = 0,
  seed = 'test-worker-queue',
): TestWorkerTaskMetadata {
  return { owner: 'test-world-owner', key, epoch, revision, seed };
}

describe('WorkerManager queued task ownership', () => {
  let hardwareConcurrency = 1;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    WorkerManager.getInstance().dispose();
    FakeWorker.instances = [];
    FakeWorker.failConstruction = false;
    hardwareConcurrency = 1;
    vi.stubGlobal('Worker', FakeWorker);
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockImplementation(
      () => hardwareConcurrency,
    );
  });

  afterEach(() => {
    WorkerManager.getInstance().dispose();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('cancels an obsolete queued task before dispatching a newer epoch', async () => {
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;
    const worker = FakeWorker.instances[0];
    const active = manager.execute('GENERATE_CHUNK', payload(0), {
      metadata: metadata('active', 1),
    });
    const obsolete = manager.execute('GENERATE_CHUNK', payload(1), {
      metadata: metadata('obsolete', 1),
    });
    const obsoleteResult = obsolete.catch(error => error as unknown);

    expect(worker.postedTasks).toHaveLength(1);
    expect(manager.getQueueLength()).toBe(1);
    expect(manager.cancelQueuedTasks('test-world-owner', task => task.epoch < 2)).toBe(1);
    expect(isWorkerTaskCancelledError(await obsoleteResult)).toBe(true);

    const current = manager.execute('GENERATE_CHUNK', payload(2), {
      metadata: metadata('current', 2),
    });
    expect(manager.getQueueLength()).toBe(1);

    worker.completeNext(TEST_RESULT);
    await active;
    expect(worker.postedTasks).toHaveLength(2);
    expect(worker.postedTasks[1].payload.cx).toBe(2);
    worker.completeNext(TEST_RESULT);
    await current;
  });

  test('coalesces duplicate queued tasks with the same owner, type, key, and epoch', () => {
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;
    const active = manager.execute('GENERATE_CHUNK', payload(0), {
      metadata: metadata('active', 1),
    });
    const first = manager.execute('GENERATE_CHUNK', payload(1), {
      metadata: metadata('duplicate', 1),
    });
    const second = manager.execute('GENERATE_CHUNK', payload(1), {
      metadata: metadata('duplicate', 1),
    });
    void active.catch(() => {});
    void first.catch(() => {});
    void second.catch(() => {});

    expect(second).toBe(first);
    expect(manager.getQueueLength()).toBe(1);
  });

  test('keeps the queued task count bounded across rapid epoch replacement', () => {
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;
    const active = manager.execute('GENERATE_CHUNK', payload(0), {
      metadata: metadata('active', 0),
    });
    void active.catch(() => {});

    for (let epoch = 1; epoch <= 32; epoch++) {
      manager.cancelQueuedTasks('test-world-owner', task => task.epoch !== epoch);
      const queued = manager.execute('GENERATE_CHUNK', payload(epoch), {
        metadata: metadata('moving-target', epoch),
      });
      void queued.catch(() => {});
      expect(manager.getQueueLength()).toBeLessThanOrEqual(1);
    }
  });

  test('does not coalesce a newer revision or a different generation seed', () => {
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;
    const active = manager.execute('GENERATE_CHUNK', payload(0), {
      metadata: metadata('active', 1),
    });
    void active.catch(() => {});
    const meshPayload: GenerateMeshPayload = {
      cx: 1,
      cy: 0,
      cz: 0,
      chunk: TEST_CHUNK,
      neighbors: {},
      chunkRevision: 1,
    };
    const firstRevision = manager.execute('GENERATE_MESH', meshPayload, {
      metadata: metadata('revisioned-mesh', 1, 1),
    });
    const secondRevision = manager.execute('GENERATE_MESH', {
      ...meshPayload,
      chunkRevision: 2,
    }, {
      metadata: metadata('revisioned-mesh', 1, 2),
    });
    const firstSeed = manager.execute('GENERATE_CHUNK', {
      ...payload(2),
      seed: 'test-seed-a',
    }, {
      metadata: metadata('seeded-generation', 1, 0, 'test-seed-a'),
    });
    const secondSeed = manager.execute('GENERATE_CHUNK', {
      ...payload(2),
      seed: 'test-seed-b',
    }, {
      metadata: metadata('seeded-generation', 1, 0, 'test-seed-b'),
    });
    for (const promise of [firstRevision, secondRevision, firstSeed, secondSeed]) {
      void promise.catch(() => {});
    }

    expect(secondRevision).not.toBe(firstRevision);
    expect(secondSeed).not.toBe(firstSeed);
    expect(manager.getQueueLength()).toBe(2);
  });

  test('removes a dead sole worker and rejects queued tasks when reconstruction fails', async () => {
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;
    const worker = FakeWorker.instances[0];
    const active = manager.execute('GENERATE_CHUNK', payload(0), {
      metadata: metadata('active-crash', 1),
    });
    const queued = manager.execute('GENERATE_CHUNK', payload(1), {
      metadata: metadata('queued-after-crash', 1),
    });
    const activeOutcome = active.catch(error => error as unknown);
    const queuedOutcome = queued.catch(error => error as unknown);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    FakeWorker.failConstruction = true;
    worker.emitError('sole worker crashed');

    expect(await activeOutcome).toBeInstanceOf(Error);
    const queuedSettlement = await Promise.race([
      queuedOutcome,
      new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
    ]);
    expect(queuedSettlement).toBeInstanceOf(Error);
    expect(worker.terminated).toBe(true);
    expect(worker.postedTasks).toHaveLength(1);
    expect((manager as unknown as WorkerManager).hasLiveWorkers()).toBe(false);
    expect(manager.getQueueLength()).toBe(0);
  });

  test('continues queued work on a surviving worker when reconstruction fails', async () => {
    hardwareConcurrency = 2;
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;
    const [failedWorker, survivingWorker] = FakeWorker.instances;
    const failedActive = manager.execute('GENERATE_CHUNK', payload(0), {
      metadata: metadata('failed-active', 1),
    });
    const survivingActive = manager.execute('GENERATE_CHUNK', payload(1), {
      metadata: metadata('surviving-active', 1),
    });
    const queued = manager.execute('GENERATE_CHUNK', payload(2), {
      metadata: metadata('queued-for-survivor', 1),
    });
    const failedOutcome = failedActive.catch(error => error as unknown);
    void queued.catch(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    FakeWorker.failConstruction = true;
    failedWorker.emitError('one worker crashed');
    expect(await failedOutcome).toBeInstanceOf(Error);
    survivingWorker.completeNext(TEST_RESULT);
    await survivingActive;

    expect(failedWorker.terminated).toBe(true);
    expect(failedWorker.postedTasks).toHaveLength(1);
    expect(survivingWorker.postedTasks).toHaveLength(2);
    survivingWorker.completeNext(TEST_RESULT);
    await queued;
    expect((manager as unknown as WorkerManager).hasLiveWorkers()).toBe(true);
  });

  test('keeps only the latest queued revision or seed for one base task key', async () => {
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;
    const active = manager.execute('GENERATE_CHUNK', payload(0), {
      metadata: metadata('active-supersede-blocker', 1),
    });
    void active.catch(() => {});
    const meshPayload: GenerateMeshPayload = {
      cx: 1,
      cy: 0,
      cz: 0,
      chunk: TEST_CHUNK,
      neighbors: {},
      chunkRevision: 1,
    };
    const revisionOne = manager.execute('GENERATE_MESH', meshPayload, {
      metadata: metadata('superseded-mesh', 1, 1),
    });
    const revisionOneOutcome = revisionOne.catch(error => error as unknown);
    const revisionTwo = manager.execute('GENERATE_MESH', {
      ...meshPayload,
      chunkRevision: 2,
    }, {
      metadata: metadata('superseded-mesh', 1, 2),
    });
    const revisionTwoOutcome = revisionTwo.catch(error => error as unknown);
    const revisionThree = manager.execute('GENERATE_MESH', {
      ...meshPayload,
      chunkRevision: 3,
    }, {
      metadata: metadata('superseded-mesh', 1, 3),
    });
    void revisionThree.catch(() => {});

    expect(revisionTwo).not.toBe(revisionOne);
    expect(revisionThree).not.toBe(revisionTwo);
    const [revisionOneSettlement, revisionTwoSettlement] = await Promise.all([
      Promise.race([
        revisionOneOutcome,
        new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
      ]),
      Promise.race([
        revisionTwoOutcome,
        new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
      ]),
    ]);
    expect(isWorkerTaskCancelledError(revisionOneSettlement)).toBe(true);
    expect(isWorkerTaskCancelledError(revisionTwoSettlement)).toBe(true);
    expect(manager.getQueueLength()).toBe(1);

    manager.cancelQueuedTasks('test-world-owner');
    await revisionThree.catch(() => {});
    const seedOne = manager.execute('GENERATE_CHUNK', {
      ...payload(2),
      seed: 'test-superseded-seed-a',
    }, {
      metadata: metadata('superseded-seed', 1, 0, 'test-superseded-seed-a'),
    });
    const seedOneOutcome = seedOne.catch(error => error as unknown);
    const seedTwo = manager.execute('GENERATE_CHUNK', {
      ...payload(2),
      seed: 'test-superseded-seed-b',
    }, {
      metadata: metadata('superseded-seed', 1, 0, 'test-superseded-seed-b'),
    });
    void seedTwo.catch(() => {});

    expect(seedTwo).not.toBe(seedOne);
    const seedOneSettlement = await Promise.race([
      seedOneOutcome,
      new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
    ]);
    expect(isWorkerTaskCancelledError(seedOneSettlement)).toBe(true);
    expect(manager.getQueueLength()).toBe(1);
  });

  test('rejects active and queued promises when disposed', async () => {
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;
    const active = manager.execute('GENERATE_CHUNK', payload(0), {
      metadata: metadata('active-on-dispose', 1),
    });
    const queued = manager.execute('GENERATE_CHUNK', payload(1), {
      metadata: metadata('queued-on-dispose', 1),
    });
    const activeOutcome = active.catch(error => error as unknown);
    const queuedOutcome = queued.catch(error => error as unknown);

    (manager as unknown as WorkerManager).dispose();

    const [activeSettlement, queuedSettlement] = await Promise.all([
      Promise.race([
        activeOutcome,
        new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
      ]),
      Promise.race([
        queuedOutcome,
        new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
      ]),
    ]);
    expect(isWorkerTaskCancelledError(activeSettlement)).toBe(true);
    expect(isWorkerTaskCancelledError(queuedSettlement)).toBe(true);
    expect(manager.getQueueLength()).toBe(0);
  });

  test('rejects execute immediately when no live worker exists', async () => {
    WorkerManager.getInstance().dispose();
    FakeWorker.failConstruction = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const manager = WorkerManager.getInstance() as unknown as QueueAwareWorkerManager;

    const outcome = await Promise.race([
      manager.execute('GENERATE_CHUNK', payload(0), {
        metadata: metadata('no-live-worker', 1),
      }).catch(error => error as unknown),
      new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 0)),
    ]);

    expect(isWorkerTaskCancelledError(outcome)).toBe(true);
    expect(manager.getQueueLength()).toBe(0);
  });
});
