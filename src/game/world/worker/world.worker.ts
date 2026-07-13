import {
  collectWorkerTransferables,
  type GenerateChunkResult,
  type GenerateMeshResult,
  type WorkerTask,
  type WorkerResult,
  type WorkerTaskHandler,
} from './WorkerTypes';
import { WorldGenerator } from '../WorldGenerator';
import { ChunkMeshBuilder } from '../ChunkMeshBuilder';
import { buildChunkVisibilitySummary } from '../streaming/ChunkVisibilitySummary';
import '../block/BlockRegistry'; // Ensure propertiesResolver is registered

// Registry of task handlers to support OCP (Open-Closed Principle)
type RegisteredTaskHandler = WorkerTaskHandler<'GENERATE_CHUNK'> | WorkerTaskHandler<'GENERATE_MESH'>;
const TaskRegistry = new Map<string, RegisteredTaskHandler>();

interface PostMessageContext {
  postMessage(message: WorkerResult, transfer?: Transferable[]): void;
}

const workerCtx = self as unknown as PostMessageContext;

// Handler for chunk data generation
class GenerateChunkHandler implements WorkerTaskHandler<'GENERATE_CHUNK'> {
  // Cache the WorldGenerator by seed to avoid re-constructing and re-seeding the noise function
  private generators = new Map<string, WorldGenerator>();

  private getGenerator(seed: string): WorldGenerator {
    let gen = this.generators.get(seed);
    if (!gen) {
      gen = new WorldGenerator(seed);
      this.generators.set(seed, gen);
    }
    return gen;
  }

  public handle(payload: WorkerTask<'GENERATE_CHUNK'>['payload']): GenerateChunkResult {
    const { cx, cy, cz, seed, chunkRevision } = payload;
    const generator = this.getGenerator(seed);
    const chunk = generator.generateChunkData(cx, cy, cz);
    return {
      chunk,
      summary: buildChunkVisibilitySummary(chunk, chunkRevision),
    };
  }
}

// Handler for chunk mesh generation
class GenerateMeshHandler implements WorkerTaskHandler<'GENERATE_MESH'> {
  public handle(payload: WorkerTask<'GENERATE_MESH'>['payload']): GenerateMeshResult {
    const { cx, cy, cz, chunk, neighbors, chunkRevision } = payload;
    return {
      mesh: ChunkMeshBuilder.buildMesh(cx, cy, cz, chunk, neighbors),
      summary: buildChunkVisibilitySummary(chunk, chunkRevision),
    };
  }
}

// Register default handlers
// Extension Point: Register new multi-threaded task handlers here!
TaskRegistry.set('GENERATE_CHUNK', new GenerateChunkHandler());
TaskRegistry.set('GENERATE_MESH', new GenerateMeshHandler());

// Self listen to messages
self.onmessage = async (e: MessageEvent<WorkerTask>) => {
  const { id, type, payload } = e.data;
  const handler = TaskRegistry.get(type);

  if (!handler) {
    workerCtx.postMessage({
      id,
      type,
      success: false,
      error: `Unsupported worker task type: ${type}`
    });
    return;
  }

  try {
    if (type === 'GENERATE_CHUNK') {
      const resultPayload = await (handler as WorkerTaskHandler<'GENERATE_CHUNK'>).handle(
        payload as WorkerTask<'GENERATE_CHUNK'>['payload'],
      );
      workerCtx.postMessage({
        id,
        type,
        success: true,
        payload: resultPayload,
      }, collectWorkerTransferables(resultPayload));
    } else {
      const resultPayload = await (handler as WorkerTaskHandler<'GENERATE_MESH'>).handle(
        payload as WorkerTask<'GENERATE_MESH'>['payload'],
      );
      workerCtx.postMessage({
        id,
        type,
        success: true,
        payload: resultPayload,
      }, collectWorkerTransferables(resultPayload));
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    workerCtx.postMessage({
      id,
      type,
      success: false,
      error: errorMessage
    });
  }
};
