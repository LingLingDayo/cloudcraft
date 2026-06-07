/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WorkerTask, WorkerResult, WorkerTaskType } from './WorkerTypes';

export class WorkerManager {
  private static instance: WorkerManager | null = null;
  private workers: Worker[] = [];
  private activeTasks = new Map<Worker, string | null>(); // worker -> active taskId
  private callbacks = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private taskQueue: WorkerTask[] = [];
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

  public execute<TResult>(type: WorkerTaskType, payload: any, transferables?: Transferable[]): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const id = `${type}_${this.nextTaskId++}_${Date.now()}`;
      const task: WorkerTask = { id, type, payload };
      if (transferables) {
        (task as any)._transfers = transferables;
      }

      this.callbacks.set(id, { resolve, reject });
      this.taskQueue.push(task);
      this.dispatchNext();
    });
  }

  private dispatchNext(): void {
    if (this.taskQueue.length === 0) return;

    // Find first idle worker
    const idleWorker = this.workers.find(w => this.activeTasks.get(w) === null);
    if (!idleWorker) return;

    const task = this.taskQueue.shift()!;
    this.activeTasks.set(idleWorker, task.id);

    // If there are transferables in the payload, they should be passed as the second argument
    // We check if the payload itself or parts of it need transfer
    const transfers: Transferable[] = (task as any)._transfers || [];
    if (task.type === 'GENERATE_CHUNK' && task.payload.chunk instanceof Uint8Array) {
      transfers.push(task.payload.chunk.buffer);
    }

    idleWorker.postMessage(task, transfers);
  }

  private handleWorkerMessage(worker: Worker, result: WorkerResult): void {
    const { id, success, payload, error } = result;
    this.activeTasks.set(worker, null);

    const cb = this.callbacks.get(id);
    if (cb) {
      this.callbacks.delete(id);
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
    const activeTaskId = this.activeTasks.get(worker);
    this.activeTasks.set(worker, null);

    if (activeTaskId) {
      const cb = this.callbacks.get(activeTaskId);
      if (cb) {
        this.callbacks.delete(activeTaskId);
        cb.reject(new Error(event.message || 'Worker thread crashed'));
      }
    }

    // Try to restart this worker
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      worker.terminate();
      try {
        const newWorker = new Worker(
          new URL('./world.worker.ts', import.meta.url),
          { type: 'module' }
        );
        newWorker.onmessage = (e: MessageEvent<WorkerResult>) => this.handleWorkerMessage(newWorker, e.data);
        newWorker.onerror = (e) => this.handleWorkerError(newWorker, e);
        this.workers[index] = newWorker;
        this.activeTasks.set(newWorker, null);
      } catch (err) {
        console.error('Failed to recreate worker after crash', err);
      }
    }

    this.dispatchNext();
  }

  public getQueueLength(): number {
    return this.taskQueue.length;
  }

  public dispose(): void {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.callbacks.clear();
    this.taskQueue = [];
    WorkerManager.instance = null;
  }
}
