import { vi, describe, test, expect } from 'vitest';
import { BLOCK_TYPES } from '../BlockConfig';
import { ChunkMeshBuilder, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../ChunkMeshBuilder';
import './BlockRegistry';

// Mock Canvas 2D context to prevent crash in jsdom environment when generating texture atlas
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

describe('Cactus Block Geometry Compilation', () => {
  test('should compile cactus geometry into cutout mesh instead of solid mesh', () => {
    // Construct a chunk array
    const chunk = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
    
    // Put a Cactus at local (2, 2, 2)
    const index = 2 + 2 * CHUNK_SIZE_X + 2 * CHUNK_SIZE_X * CHUNK_SIZE_Z;
    chunk[index] = BLOCK_TYPES.CACTUS;

    const neighbors = {
      px: new Uint8Array(chunk.length),
      nx: new Uint8Array(chunk.length),
      py: new Uint8Array(chunk.length),
      ny: new Uint8Array(chunk.length),
      pz: new Uint8Array(chunk.length),
      nz: new Uint8Array(chunk.length),
    };

    const meshResult = ChunkMeshBuilder.buildMesh(0, 0, 0, chunk, neighbors);

    // Cactus is a transparent/cutout block with complex geometry. It should be in cutout mesh.
    expect(meshResult.cutout).not.toBeNull();
    expect(meshResult.solid).toBeNull(); // No solid blocks in this chunk

    const positions = meshResult.cutout!.positions;
    expect(positions.length).toBeGreaterThan(0);

    // Verify there are vertices with shrunk X coordinates (2 + 0.0625 = 2.0625, or 2 + 0.9375 = 2.9375)
    let foundShrunkX = false;
    let foundShrunkZ = false;

    for (let i = 0; i < positions.length; i += 3) {
      const xVal = positions[i];
      const zVal = positions[i + 2];
      
      if (Math.abs(xVal - 2.0625) < 1e-4 || Math.abs(xVal - 2.9375) < 1e-4) {
        foundShrunkX = true;
      }
      if (Math.abs(zVal - 2.0625) < 1e-4 || Math.abs(zVal - 2.9375) < 1e-4) {
        foundShrunkZ = true;
      }
    }

    expect(foundShrunkX).toBe(true);
    expect(foundShrunkZ).toBe(true);
  });
});
