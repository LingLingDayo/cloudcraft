import { describe, expect, test, vi } from 'vitest';
import { World } from './World';
import { ChunkMeshBuilder } from './ChunkMeshBuilder';
import { TEST_CHUNK_BYTE_LENGTH } from './WorldChunkManagerTestUtils';

describe('ChunkRenderer sparse mesh allocation', () => {
  test('keeps an empty chunk loaded without adding empty Three.js objects', () => {
    const world = new World('test-empty-chunk-renderer');
    const renderer = world.getRenderer();
    const addToScene = vi.spyOn(world.group, 'add');
    const meshResult = ChunkMeshBuilder.buildMesh(
      0,
      16,
      0,
      new Uint8Array(TEST_CHUNK_BYTE_LENGTH),
      {},
    );

    expect(meshResult).toEqual({ solid: null, transparent: null, cutout: null });

    renderer.applyMeshResult(0, 16, 0, meshResult);

    expect(renderer.hasChunkMesh('0,16,0')).toBe(true);
    expect(renderer.hasRenderableChunkMesh('0,16,0')).toBe(false);
    expect(renderer.getChunkMeshes().get('0,16,0')).toEqual({
      solid: null,
      transparent: null,
      cutout: null,
    });
    expect(addToScene).not.toHaveBeenCalled();
  });
});
