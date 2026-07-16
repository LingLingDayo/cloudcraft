import { describe, expect, test, vi } from 'vitest';
import {
  ChunkMeshBuilder,
  PACKED_MAX_SKY_LIGHT,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
} from './ChunkMeshBuilder';
import { BLOCK_TYPES } from './BlockConfig';
import './block/BlockRegistry';

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

function makeSolidSurfaceChunk(): Uint8Array {
  const chunk = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z * 2);
  // Fill a solid floor at ly=0 with full packed sky light; air above also full sky.
  for (let z = 0; z < CHUNK_SIZE_Z; z++) {
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let y = 0; y < CHUNK_SIZE_Y; y++) {
        const idx = (x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z) * 2;
        chunk[idx] = y === 0 ? BLOCK_TYPES.STONE : BLOCK_TYPES.AIR;
        chunk[idx + 1] = PACKED_MAX_SKY_LIGHT;
      }
    }
  }
  return chunk;
}

describe('ChunkMeshBuilder packed light', () => {
  test('PACKED_MAX_SKY_LIGHT unpacks to sky=15 block=0', () => {
    expect(PACKED_MAX_SKY_LIGHT).toBe(240);
    expect((PACKED_MAX_SKY_LIGHT >> 4) & 0x0f).toBe(15);
    expect(PACKED_MAX_SKY_LIGHT & 0x0f).toBe(0);
    // Raw 15 is the historical bug: sky=0 block=15
    expect((15 >> 4) & 0x0f).toBe(0);
    expect(15 & 0x0f).toBe(15);
  });

  test('missing neighbors must not bake sky=0 block=15 edge lights', () => {
    const chunk = makeSolidSurfaceChunk();
    // No neighbors — previously defaulted to raw 15 and baked torch-looking strips
    const mesh = ChunkMeshBuilder.buildMesh(0, 0, 0, chunk, {});
    expect(mesh.solid).not.toBeNull();
    const lights = mesh.solid!.valLights;
    let bad = 0;
    let skySamples = 0;
    for (let i = 0; i < lights.length; i += 2) {
      const sky = lights[i];
      const block = lights[i + 1];
      if (sky === 0 && block === 15) bad++;
      if (sky > 0) skySamples++;
    }
    expect(bad).toBe(0);
    expect(skySamples).toBeGreaterThan(0);
  });
});
