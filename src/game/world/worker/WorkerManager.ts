import type {
  WorkerTask,
  WorkerResult,
  WorkerTaskPayloadMap,
  WorkerTaskResultMap,
  WorkerTaskType,
} from './WorkerTypes';

interface QueuedTask {
  task: WorkerTask;
  transfers: Transferable[];
  metadata?: WorkerTaskMetadata;
  identity?: string;
  promise: Promise<unknown>;
}

export interface WorkerTaskMetadata {
  readonly owner: string;
  readonly key: string;
  readonly epoch: number;
  readonly revision: number;
  readonly seed: string;
}

export interface WorkerExecutionOptions {
  readonly transferables?: readonly Transferable[];
  readonly metadata?: WorkerTaskMetadata;
}

interface WorkerTaskCallback {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly identity?: string;
}

export class WorkerTaskCancelledError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkerTaskCancelledError';
  }
}

export function isWorkerTaskCancelledError(error: unknown): boolean {
  return error instanceof WorkerTaskCancelledError
    || (error instanceof Error && error.name === 'WorkerTaskCancelledError');
}

export class WorkerManager {
  private static instance: WorkerManager | null = null;
  private workers: Worker[] = [];
  private activeTasks = new Map<Worker, string | null>(); // worker -> active taskId
  private callbacks = new Map<string, WorkerTaskCallback>();
  private taskPromisesByIdentity = new Map<string, Promise<unknown>>();
  private taskQueue: QueuedTask[] = [];
  private nextTaskId = 0;
  private maxWorkers = 4;

  private constructor() {
    this.maxWorkers = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8));
    this.initWorkers();
  }

  public static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  public hasLiveWorkers(): boolean {
    return this.workers.length > 0;
  }

  public getIdleWorkerCount(): number {
    let idleWorkers = 0;
    for (const worker of this.workers) {
      if (this.activeTasks.get(worker) === null) idleWorkers++;
    }
    return idleWorkers;
  }

  private getTaskIdentity(type: WorkerTaskType, metadata: WorkerTaskMetadata): string {
    return [
      metadata.owner,
      type,
      metadata.key,
      metadata.epoch,
      metadata.revision,
      metadata.seed,
    ].join('\u0000');
  }

  private initWorkers(): void {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers are not supported in this environment. Running in fallback mode.');
      return;
    }

    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        // Vite support for worker loading via ESM URL syntax
        const worker = new Worker(
          new URL('./world.worker.ts', import.meta.url),
          { type: 'module' }
        );
        worker.onmessage = (e: MessageEvent<WorkerResult>) => this.handleWorkerMessage(worker, e.data);
        worker.onerror = (e) => this.handleWorkerError(worker, e);
        this.workers.push(worker);
        this.activeTasks.set(worker, null);
      } catch (err) {
        console.error('Failed to initialize Web Worker', err);
      }
    }
  }

  public execute<TType extends WorkerTaskType>(
    type: TType,
    payload: WorkerTaskPayloadMap[TType],
    options: WorkerExecutionOptions = {},
  ): Promise<WorkerTaskResultMap[TType]> {
    if (!this.hasLiveWorkers()) {
      return Promise.reject(new WorkerTaskCancelledError(
        `No live worker is available for task ${type}`,
      ));
    }

    const metadata = options.metadata ? { ...options.metadata } : undefined;
    const identity = metadata ? this.getTaskIdentity(type, metadata) : undefined;
    const existingPromise = identity ? this.taskPromisesByIdentity.get(identity) : undefined;
    if (existingPromise) return existingPromise as Promise<WorkerTaskResultMap[TType]>;

    if (metadata) {
      const retainedTasks: QueuedTask[] = [];
      for (const queued of this.taskQueue) {
        if (
          queued.metadata?.owner === metadata.owner
          && queued.task.type === type
          && queued.metadata.key === metadata.key
          && queued.metadata.epoch === metadata.epoch
        ) {
          this.rejectQueuedTask(queued, new WorkerTaskCancelledError(
            `Superseded queued worker task ${type} for ${metadata.key}`,
          ));
        } else {
          retainedTasks.push(queued);
        }
      }
      this.taskQueue = retainedTasks;
    }

    const id = `${type}_${this.nextTaskId++}_${Date.now()}`;
    const task = { id, type, payload } as WorkerTask;
    const transfers = options.transferables ? [...options.transferables] : [];
    let resolveTask!: (value: WorkerTaskResultMap[TType]) => void;
    let rejectTask!: (error: Error) => void;
    const promise = new Promise<WorkerTaskResultMap[TType]>((resolve, reject) => {
      resolveTask = resolve;
      rejectTask = reject;
    });

    this.callbacks.set(id, {
      resolve: value => resolveTask(value as WorkerTaskResultMap[TType]),
      reject: rejectTask,
      identity,
    });
    if (identity) this.taskPromisesByIdentity.set(identity, promise);
    this.taskQueue.push({ task, transfers, metadata, identity, promise });
    this.dispatchNext();
    return promise;
  }

  private dispatchNext(): void {
    while (this.taskQueue.length > 0) {
      const idleWorker = this.workers.find(worker => this.activeTasks.get(worker) === null);
      if (!idleWorker) return;

      const queued = this.taskQueue.shift()!;
      this.activeTasks.set(idleWorker, queued.task.id);
      idleWorker.postMessage(queued.task, queued.transfers);
    }
  }

  public cancelQueuedTasks(
    owner: string,
    shouldCancel: (metadata: WorkerTaskMetadata) => boolean = () => true,
  ): number {
    const retainedTasks: QueuedTask[] = [];
    let cancelledCount = 0;

    for (const queued of this.taskQueue) {
      if (!queued.metadata || queued.metadata.owner !== owner || !shouldCancel(queued.metadata)) {
        retainedTasks.push(queued);
        continue;
      }

      cancelledCount++;
      this.rejectQueuedTask(queued, new WorkerTaskCancelledError(
        `Cancelled queued worker task ${queued.task.type} for ${queued.metadata.key}`,
      ));
    }

    this.taskQueue = retainedTasks;
    this.dispatchNext();
    return cancelledCount;
  }

  private rejectQueuedTask(queued: QueuedTask, error: WorkerTaskCancelledError): void {
    const callback = this.callbacks.get(queued.task.id);
    this.callbacks.delete(queued.task.id);
    if (queued.identity && this.taskPromisesByIdentity.get(queued.identity) === queued.promise) {
      this.taskPromisesByIdentity.delete(queued.identity);
    }
    callback?.reject(error);
  }

  private clearTaskIdentity(callback: WorkerTaskCallback | undefined): void {
    if (callback?.identity) this.taskPromisesByIdentity.delete(callback.identity);
  }

  private handleWorkerMessage(worker: Worker, result: WorkerResult): void {
    const { id, success, payload, error } = result;
    this.activeTasks.set(worker, null);

    const cb = this.callbacks.get(id);
    if (cb) {
      this.callbacks.delete(id);
      this.clearTaskIdentity(cb);
      if (success) {
        cb.resolve(payload);
      } else {
        cb.reject(new Error(error || 'Unknown error inside worker'));
      }
    }

    this.dispatchNext();
  }

  private handleWorkerError(worker: Worker, event: ErrorEvent): void {
    console.error('Web Worker general error', event);
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex === -1) return;
    const activeTaskId = this.activeTasks.get(worker);

    if (activeTaskId) {
      const cb = this.callbacks.get(activeTaskId);
      if (cb) {
        this.callbacks.delete(activeTaskId);
        this.clearTaskIdentity(cb);
        cb.reject(new Error(event.message || 'Worker thread crashed'));
      }
    }

    worker.terminate();
    this.workers.splice(workerIndex, 1);
    this.activeTasks.delete(worker);

    try {
      const newWorker = new Worker(
        new URL('./world.worker.ts', import.meta.url),
        { type: 'module' }
      );
      newWorker.onmessage = (e: MessageEvent<WorkerResult>) => this.handleWorkerMessage(newWorker, e.data);
      newWorker.onerror = (e) => this.handleWorkerError(newWorker, e);
      this.workers.splice(workerIndex, 0, newWorker);
      this.activeTasks.set(newWorker, null);
    } catch (err) {
      console.error('Failed to recreate worker after crash', err);
    }

    if (this.workers.length === 0) {
      const queuedTasks = this.taskQueue;
      this.taskQueue = [];
      for (const queued of queuedTasks) {
        this.rejectQueuedTask(queued, new WorkerTaskCancelledError(
          `No live worker remains for queued task ${queued.task.type}`,
        ));
      }
      return;
    }

    this.dispatchNext();
  }

  public getQueueLength(): number {
    return this.taskQueue.length;
  }

  public dispose(): void {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.activeTasks.clear();
    for (const callback of this.callbacks.values()) {
      callback.reject(new WorkerTaskCancelledError('Worker manager disposed'));
    }
    this.callbacks.clear();
    this.taskPromisesByIdentity.clear();
    this.taskQueue = [];
    WorkerManager.instance = null;
  }
}
