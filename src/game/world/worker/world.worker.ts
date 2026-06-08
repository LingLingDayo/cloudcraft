import type { WorkerTask, WorkerResult, WorkerTaskHandler } from './WorkerTypes';
import { WorldGenerator } from '../WorldGenerator';
import { ChunkMeshBuilder } from '../ChunkMeshBuilder';
import type { ChunkNeighbors, ChunkMeshResult } from '../ChunkMeshBuilder';
import '../block/BlockRegistry'; // Ensure propertiesResolver is registered

// Registry of task handlers to support OCP (Open-Closed Principle)
const TaskRegistry = new Map<string, WorkerTaskHandler>();

interface PostMessageContext {
  postMessage(message: WorkerResult, transfer?: Transferable[]): void;
}

const workerCtx = self as unknown as PostMessageContext;

// Handler for chunk data generation
class GenerateChunkHandler implements WorkerTaskHandler {
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

  public handle(payload: unknown): Uint8Array {
    const { cx, cy, cz, seed } = payload as { cx: number; cy: number; cz: number; seed: string };
    const generator = this.getGenerator(seed);
    return generator.generateChunkData(cx, cy, cz);
  }
}

// Handler for chunk mesh generation
class GenerateMeshHandler implements WorkerTaskHandler {
  public handle(payload: unknown): unknown {
    const { cx, cy, cz, chunk, neighbors } = payload as {
      cx: number;
      cy: number;
      cz: number;
      chunk: Uint8Array;
      neighbors: ChunkNeighbors;
    };
    return ChunkMeshBuilder.buildMesh(cx, cy, cz, chunk, neighbors);
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
    const resultPayload = await handler.handle(payload);
    
    // Transfer buffer if the result payload contains an ArrayBuffer/TypedArray
    const transferables: Transferable[] = [];
    if (resultPayload instanceof Uint8Array) {
      transferables.push(resultPayload.buffer);
    } else if (resultPayload && typeof resultPayload === 'object') {
      const meshResult = resultPayload as ChunkMeshResult;
      ['solid', 'transparent', 'cutout'].forEach(key => {
        const geom = meshResult[key as keyof ChunkMeshResult];
        if (geom) {
          if (geom.positions instanceof Float32Array) transferables.push(geom.positions.buffer);
          if (geom.normals instanceof Float32Array) transferables.push(geom.normals.buffer);
          if (geom.uvs instanceof Float32Array) transferables.push(geom.uvs.buffer);
          if (geom.atlasOffsets instanceof Float32Array) transferables.push(geom.atlasOffsets.buffer);
        }
      });
    }

    workerCtx.postMessage({
      id,
      type,
      success: true,
      payload: resultPayload
    }, transferables);
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
