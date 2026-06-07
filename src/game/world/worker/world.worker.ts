/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WorkerTask, WorkerResult, WorkerTaskHandler } from './WorkerTypes';
import { WorldGenerator } from '../WorldGenerator';

// Registry of task handlers to support OCP (Open-Closed Principle)
const TaskRegistry = new Map<string, WorkerTaskHandler>();

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

  public handle(payload: { cx: number; cy: number; cz: number; seed: string }): Uint8Array {
    const { cx, cy, cz, seed } = payload;
    const generator = this.getGenerator(seed);
    return generator.generateChunkData(cx, cy, cz);
  }
}

// Register default handlers
// Extension Point: Register new multi-threaded task handlers here!
TaskRegistry.set('GENERATE_CHUNK', new GenerateChunkHandler());

// Self listen to messages
self.onmessage = async (e: MessageEvent<WorkerTask>) => {
  const { id, type, payload } = e.data;
  const handler = TaskRegistry.get(type);

  if (!handler) {
    (self as any).postMessage({
      id,
      type,
      success: false,
      error: `Unsupported worker task type: ${type}`
    } as WorkerResult);
    return;
  }

  try {
    const resultPayload = await handler.handle(payload);
    
    // Transfer buffer if the result payload contains an ArrayBuffer/TypedArray
    const transferables: Transferable[] = [];
    if (resultPayload instanceof Uint8Array) {
      transferables.push(resultPayload.buffer);
    }

    (self as any).postMessage({
      id,
      type,
      success: true,
      payload: resultPayload
    } as WorkerResult, transferables);
  } catch (err: any) {
    (self as any).postMessage({
      id,
      type,
      success: false,
      error: err?.message || String(err)
    } as WorkerResult);
  }
};
