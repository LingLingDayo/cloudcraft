import { World, CHUNK_SIZE_X, CHUNK_SIZE_Z, CHUNK_SIZE_Y } from './World';

export class WorldSerializer {
  // Compress Uint8Array block data using Run-Length Encoding (RLE) to keep save size minimal
  public static compressRLE(data: Uint8Array): string {
    const parts: string[] = [];
    if (data.length === 0) return '';
    let count = 1;
    let current = data[0];
    for (let i = 1; i < data.length; i++) {
      if (data[i] === current) {
        count++;
      } else {
        parts.push(`${current}_${count}`);
        current = data[i];
        count = 1;
      }
    }
    parts.push(`${current}_${count}`);
    return parts.join(',');
  }

  // Decompress RLE compressed string back to Uint8Array of fixed length
  public static decompressRLE(rleStr: string, length: number): Uint8Array {
    const result = new Uint8Array(length);
    const parts = rleStr.split(',');
    let idx = 0;
    for (const part of parts) {
      if (!part) continue;
      const separatorIdx = part.indexOf('_');
      if (separatorIdx === -1) {
        // Fallback for single numbers in case of corruption
        const val = Number(part);
        if (idx < length) {
          result[idx++] = val;
        }
        continue;
      }
      const val = Number(part.substring(0, separatorIdx));
      const count = Number(part.substring(separatorIdx + 1));
      for (let i = 0; i < count; i++) {
        if (idx < length) {
          result[idx++] = val;
        }
      }
    }
    return result;
  }

  // Serialize world to JSON (using RLE compression to fit within browser storage quota)
  public static saveWorld(world: World): string {
    const serializedChunks: Record<string, string> = {};
    for (const [key, bytes] of world.chunks.entries()) {
      serializedChunks[key] = this.compressRLE(bytes);
    }
    return JSON.stringify({
      seed: world.getSeed(),
      chunks: serializedChunks,
      entities: world.blockEntities.serialize()
    });
  }

  // Load world from JSON (supports both modern RLE compressed and legacy flat CSV formatted saves)
  public static loadWorld(world: World, saveStr: string): void {
    try {
      const saved = JSON.parse(saveStr);
      if (saved.seed) {
        world.setSeed(saved.seed);
      }
      if (saved.chunks) {
        // Clear current meshes
        const renderer = world.getRenderer();
        const chunkMeshes = renderer.getChunkMeshes();
        for (const key of chunkMeshes.keys()) {
          renderer.removeChunkMesh(key);
        }
        chunkMeshes.clear();
        world.chunks.clear();

        // Restore chunk data
        const expectedLength = CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y;
        for (const [key, csv] of Object.entries(saved.chunks)) {
          const csvStr = csv as string;
          if (csvStr.includes('_')) {
            // Modern compressed format
            world.chunks.set(key, this.decompressRLE(csvStr, expectedLength));
          } else {
            // Legacy flat CSV format
            const numbers = csvStr.split(',').map(Number);
            world.chunks.set(key, new Uint8Array(numbers));
          }
        }
      }
      if (saved.entities) {
        world.blockEntities.deserialize(saved.entities);
      } else {
        world.blockEntities.clear();
      }
    } catch (e) {
      console.error('Failed to load world', e);
    }
  }
}
