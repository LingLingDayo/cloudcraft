import type { ChunkMeshResult, ChunkNeighbors } from '../ChunkMeshBuilder';
import type { ChunkVisibilitySummary } from '../streaming/ChunkVisibilitySummary';

export interface GenerateChunkPayload {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly seed: string;
  readonly chunkRevision: number;
}

export interface GenerateChunkResult {
  readonly chunk: Uint8Array;
  readonly summary: ChunkVisibilitySummary;
}

export interface GenerateMeshPayload {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly chunk: Uint8Array;
  readonly neighbors: ChunkNeighbors;
  readonly chunkRevision: number;
}

export interface GenerateMeshResult {
  readonly mesh: ChunkMeshResult;
  readonly summary: ChunkVisibilitySummary;
}

export interface WorkerTaskPayloadMap {
  readonly GENERATE_CHUNK: GenerateChunkPayload;
  readonly GENERATE_MESH: GenerateMeshPayload;
}

export interface WorkerTaskResultMap {
  readonly GENERATE_CHUNK: GenerateChunkResult;
  readonly GENERATE_MESH: GenerateMeshResult;
}

export type WorkerTaskType = keyof WorkerTaskPayloadMap;

export type WorkerTask<TType extends WorkerTaskType = WorkerTaskType> = {
  [TKey in TType]: {
    readonly id: string;
    readonly type: TKey;
    readonly payload: WorkerTaskPayloadMap[TKey];
  }
}[TType];

export type WorkerResult<TType extends WorkerTaskType = WorkerTaskType> = {
  [TKey in TType]: {
    readonly id: string;
    readonly type: TKey;
    readonly success: boolean;
    readonly payload?: WorkerTaskResultMap[TKey];
    readonly error?: string;
  }
}[TType];

export interface WorkerTaskHandler<TType extends WorkerTaskType> {
  handle(
    payload: WorkerTaskPayloadMap[TType],
  ): WorkerTaskResultMap[TType] | Promise<WorkerTaskResultMap[TType]>;
}

/** Collects nested result buffers once so the worker can transfer them without copying. */
export function collectWorkerTransferables(value: unknown): Transferable[] {
  const transferables: Transferable[] = [];
  const seenBuffers = new Set<ArrayBuffer>();

  const visit = (candidate: unknown): void => {
    if (candidate instanceof ArrayBuffer) {
      if (!seenBuffers.has(candidate)) {
        seenBuffers.add(candidate);
        transferables.push(candidate);
      }
      return;
    }
    if (ArrayBuffer.isView(candidate)) {
      const buffer = candidate.buffer;
      if (buffer instanceof ArrayBuffer && !seenBuffers.has(buffer)) {
        seenBuffers.add(buffer);
        transferables.push(buffer);
      }
      return;
    }
    if (!candidate || typeof candidate !== 'object') return;
    for (const nestedValue of Object.values(candidate)) visit(nestedValue);
  };

  visit(value);
  return transferables;
}
