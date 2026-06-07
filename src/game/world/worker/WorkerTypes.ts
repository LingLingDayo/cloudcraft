/* eslint-disable @typescript-eslint/no-explicit-any */
export type WorkerTaskType = 'GENERATE_CHUNK';

export interface WorkerTask {
  id: string;
  type: WorkerTaskType;
  payload: any;
}

export interface WorkerResult {
  id: string;
  type: WorkerTaskType;
  success: boolean;
  payload?: any;
  error?: string;
}

export interface WorkerTaskHandler {
  handle(payload: any): any | Promise<any>;
}
