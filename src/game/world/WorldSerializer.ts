import type { World } from './World';
import {
  EMPTY_DYNAMIC_MATERIAL_SNAPSHOT,
  type DynamicMaterialSnapshot,
} from '@game/dynamics/DynamicMaterialSnapshot';
import type { BlockEntity } from './block/BlockEntity';

const COORDINATE_KEY_PATTERN = /^-?\d+,-?\d+,-?\d+$/;
const LOCAL_COORDINATE_KEY_PATTERN = /^\d+,\d+,\d+$/;
const MAX_LOCAL_COORDINATE = 15;
const MAX_BLOCK_TYPE = 255;

interface PreparedWorldRestore {
  readonly seed?: string;
  readonly modifiedBlocks: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly blockEntities: readonly BlockEntity[];
  readonly dynamicMaterials: DynamicMaterialSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLocalCoordinateKey(key: string): boolean {
  if (!LOCAL_COORDINATE_KEY_PATTERN.test(key)) return false;
  return key.split(',').every(value => Number(value) <= MAX_LOCAL_COORDINATE);
}

function prepareModifiedBlocks(
  value: unknown,
): ReadonlyMap<string, ReadonlyMap<string, number>> {
  if (value === undefined) return new Map();
  if (!isRecord(value)) {
    throw new Error('World modified blocks must be an object');
  }

  const modifiedBlocks = new Map<string, ReadonlyMap<string, number>>();
  for (const [chunkKey, chunkData] of Object.entries(value)) {
    if (!COORDINATE_KEY_PATTERN.test(chunkKey) || !isRecord(chunkData)) {
      throw new Error(`World modified chunk is invalid: ${chunkKey}`);
    }
    const modifiedChunk = new Map<string, number>();
    for (const [positionKey, blockType] of Object.entries(chunkData)) {
      if (
        !validateLocalCoordinateKey(positionKey)
        || !Number.isInteger(blockType)
        || Number(blockType) < 0
        || Number(blockType) > MAX_BLOCK_TYPE
      ) {
        throw new Error(`World modified block is invalid: ${chunkKey}/${positionKey}`);
      }
      modifiedChunk.set(positionKey, Number(blockType));
    }
    modifiedBlocks.set(chunkKey, modifiedChunk);
  }
  return modifiedBlocks;
}

function prepareWorldRestore(world: World, saveStr: string): PreparedWorldRestore {
  const value: unknown = JSON.parse(saveStr);
  if (!isRecord(value)) {
    throw new Error('World snapshot must be an object');
  }
  if (value.seed !== undefined && (typeof value.seed !== 'string' || value.seed.length === 0)) {
    throw new Error('World snapshot seed must be a non-empty string');
  }
  if (value.entities !== undefined && typeof value.entities !== 'string') {
    throw new Error('World block entities must be a serialized string');
  }

  const dynamicMaterials = value.dynamicMaterials ?? EMPTY_DYNAMIC_MATERIAL_SNAPSHOT;
  world.dynamicMaterials.validateSnapshot(dynamicMaterials);
  return {
    seed: value.seed,
    modifiedBlocks: prepareModifiedBlocks(value.modified),
    blockEntities: world.blockEntities.prepareSerialized(value.entities ?? ''),
    dynamicMaterials: dynamicMaterials as DynamicMaterialSnapshot,
  };
}

export class WorldSerializer {
  // Serialize world to JSON (only saves modified blocks to keep save size minimal)
  public static saveWorld(world: World): string {
    const serializedModified: Record<string, Record<string, number>> = {};
    for (const [chunkKey, modifiedMap] of world.modifiedBlocks.entries()) {
      if (modifiedMap.size > 0) {
        const chunkData: Record<string, number> = {};
        for (const [posKey, type] of modifiedMap.entries()) {
          chunkData[posKey] = type;
        }
        serializedModified[chunkKey] = chunkData;
      }
    }
    return JSON.stringify({
      seed: world.getSeed(),
      modified: serializedModified,
      entities: world.blockEntities.serialize(),
      dynamicMaterials: world.dynamicMaterials.createSnapshot(),
    });
  }

  // Load world from JSON
  public static loadWorld(world: World, saveStr: string): void {
    const prepared = prepareWorldRestore(world, saveStr);
    if (prepared.seed !== undefined) {
      world.setSeed(prepared.seed);
    }
      
    const renderer = world.getRenderer();
    const chunkMeshes = renderer.getChunkMeshes();
    for (const key of chunkMeshes.keys()) {
      renderer.removeChunkMesh(key);
    }
    chunkMeshes.clear();
    world.chunks.clear();
    world.modifiedBlocks.clear();
    for (const [chunkKey, modifiedChunk] of prepared.modifiedBlocks) {
      world.modifiedBlocks.set(chunkKey, new Map(modifiedChunk));
    }
    world.blockEntities.restorePrepared(prepared.blockEntities);
    world.dynamicMaterials.restoreSnapshot(prepared.dynamicMaterials);
  }
}

