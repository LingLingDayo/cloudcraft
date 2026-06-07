export type WorkerTaskType = 'GENERATE_CHUNK';

export interface WorkerTask {
  id: string;
  type: WorkerTaskType;
  payload: unknown;
}

export interface WorkerResult {
  id: string;
  type: WorkerTaskType;
  success: boolean;
  payload?: unknown;
  error?: string;
}

export interface WorkerTaskHandler {
  handle(payload: unknown): unknown | Promise<unknown>;
}
