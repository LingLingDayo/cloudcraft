import { describe, expect, test } from 'vitest';
import { BLOCK_TYPES } from '../BlockConfig';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../World';
import {
  buildChunkVisibilitySummary,
  ChunkFace,
  hasPortalConnection,
  type ChunkVisibilitySummary,
} from './ChunkVisibilitySummary';
import {
  ChunkVisibilityResolver,
  type ChunkCoordinate,
  type ChunkStreamingView,
  type ChunkVisibilityState,
} from './ChunkVisibilityResolver';

const CHUNK_VOLUME = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
const TEST_REVISION = 7;

function chunkKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function createChunk(blockType: number): Uint8Array {
  const chunk = new Uint8Array(CHUNK_VOLUME * 2);
  for (let index = 0; index < CHUNK_VOLUME; index++) {
    chunk[index * 2] = blockType;
  }
  return chunk;
}

function setBlock(chunk: Uint8Array, x: number, y: number, z: number, blockType: number): void {
  const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
  chunk[index * 2] = blockType;
}

function state(summary: ChunkVisibilitySummary, revision = summary.chunkRevision): ChunkVisibilityState {
  return { summary, revision };
}

function fallbackState(
  fallbackSummary: ChunkVisibilitySummary,
  revision: number,
): ChunkVisibilityState {
  return { summary: undefined, fallbackSummary, revision };
}

function createResolverInput(
  states: ReadonlyMap<string, ChunkVisibilityState>,
  options: {
    center?: ChunkCoordinate;
    radius?: number;
    view?: ChunkStreamingView | null;
    fallback?: ChunkVisibilityState;
    minChunkY?: number;
    maxChunkYExclusive?: number;
  } = {},
) {
  const opaqueFallback = state(
    buildChunkVisibilitySummary(createChunk(BLOCK_TYPES.STONE), TEST_REVISION),
  );

  return {
    center: options.center ?? { x: 0, y: 1, z: 0 },
    radius: options.radius ?? 3,
    minChunkY: options.minChunkY ?? 0,
    maxChunkYExclusive: options.maxChunkYExclusive ?? 4,
    view: options.view ?? null,
    getChunkState: (key: string) => states.get(key) ?? options.fallback ?? opaqueFallback,
  };
}

describe('Chunk visibility portal summary', () => {
  test('a fully opaque chunk exposes no portal connection', () => {
    const summary = buildChunkVisibilitySummary(
      createChunk(BLOCK_TYPES.STONE),
      TEST_REVISION,
    );

    expect(summary.chunkRevision).toBe(TEST_REVISION);
    expect(summary.portalMask).toBe(0);
    expect(hasPortalConnection(summary, ChunkFace.NegativeX, ChunkFace.PositiveX)).toBe(false);
  });

  test('a transparent tunnel only connects the two faces it reaches', () => {
    const chunk = createChunk(BLOCK_TYPES.STONE);
    const tunnelY = Math.floor(CHUNK_SIZE_Y / 2);
    const tunnelZ = Math.floor(CHUNK_SIZE_Z / 2);
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      setBlock(chunk, x, tunnelY, tunnelZ, BLOCK_TYPES.AIR);
    }

    const summary = buildChunkVisibilitySummary(chunk, TEST_REVISION);

    expect(hasPortalConnection(summary, ChunkFace.NegativeX, ChunkFace.PositiveX)).toBe(true);
    expect(hasPortalConnection(summary, ChunkFace.NegativeX, ChunkFace.PositiveY)).toBe(false);
    expect(hasPortalConnection(summary, ChunkFace.PositiveX, ChunkFace.PositiveZ)).toBe(false);
  });
});

describe('Chunk visibility topology propagation', () => {
  const transparentSummary = buildChunkVisibilitySummary(
    createChunk(BLOCK_TYPES.AIR),
    TEST_REVISION,
  );
  const opaqueSummary = buildChunkVisibilitySummary(
    createChunk(BLOCK_TYPES.STONE),
    TEST_REVISION,
  );

  test('an opaque chunk is directly visible but only contributes one safety-buffer layer behind it', () => {
    const states = new Map<string, ChunkVisibilityState>([
      [chunkKey(0, 1, 0), state(transparentSummary)],
      [chunkKey(1, 1, 0), state(opaqueSummary)],
    ]);

    const result = new ChunkVisibilityResolver().resolve(createResolverInput(states));

    expect(result.directVisible.has(chunkKey(1, 1, 0))).toBe(true);
    expect(result.directVisible.has(chunkKey(2, 1, 0))).toBe(false);
    expect(result.active.has(chunkKey(2, 1, 0))).toBe(true);
    expect(result.active.has(chunkKey(3, 1, 0))).toBe(false);
  });

  test('transparent topology propagates behind a chunk before adding one safety-buffer layer', () => {
    const states = new Map<string, ChunkVisibilityState>([
      [chunkKey(0, 1, 0), state(transparentSummary)],
      [chunkKey(1, 1, 0), state(transparentSummary)],
      [chunkKey(2, 1, 0), state(opaqueSummary)],
    ]);

    const result = new ChunkVisibilityResolver().resolve(createResolverInput(states));

    expect(result.directVisible.has(chunkKey(2, 1, 0))).toBe(true);
    expect(result.active.has(chunkKey(3, 1, 0))).toBe(true);
    expect(result.active.has(chunkKey(4, 1, 0))).toBe(false);
  });

  test('keeps the safety buffer inside the configured render radius', () => {
    const states = new Map<string, ChunkVisibilityState>([
      [chunkKey(0, 1, 0), state(transparentSummary)],
      [chunkKey(1, 1, 0), state(opaqueSummary)],
    ]);
    const result = new ChunkVisibilityResolver().resolve(createResolverInput(states, {
      radius: 1,
    }));

    expect(result.directVisible.has(chunkKey(1, 1, 0))).toBe(true);
    expect(result.active.has(chunkKey(2, 1, 0))).toBe(false);
  });

  test('loads only one safety layer below an opaque surface', () => {
    const states = new Map<string, ChunkVisibilityState>([
      [chunkKey(0, 3, 0), state(transparentSummary)],
      [chunkKey(0, 2, 0), state(opaqueSummary)],
    ]);
    const result = new ChunkVisibilityResolver().resolve(createResolverInput(states, {
      center: { x: 0, y: 3, z: 0 },
      radius: 4,
      maxChunkYExclusive: 8,
    }));

    expect(result.directVisible.has(chunkKey(0, 2, 0))).toBe(true);
    expect(result.directVisible.has(chunkKey(0, 1, 0))).toBe(false);
    expect(result.active.has(chunkKey(0, 1, 0))).toBe(true);
    expect(result.active.has(chunkKey(0, 0, 0))).toBe(false);
  });

  test('a stale compatible summary preserves its previous topology during remeshing', () => {
    const states = new Map<string, ChunkVisibilityState>([
      [chunkKey(0, 1, 0), state(transparentSummary)],
      [chunkKey(1, 1, 0), fallbackState(transparentSummary, TEST_REVISION + 1)],
      [chunkKey(2, 1, 0), state(opaqueSummary)],
    ]);

    const result = new ChunkVisibilityResolver().resolve(createResolverInput(states));

    expect(result.directVisible.has(chunkKey(1, 1, 0))).toBe(true);
    expect(result.directVisible.has(chunkKey(2, 1, 0))).toBe(true);
    expect(result.active.has(chunkKey(3, 1, 0))).toBe(true);
  });

  test('an incompatible summary stops at the unknown frontier with one safety buffer', () => {
    const incompatibleSummary = {
      ...transparentSummary,
      schemaVersion: transparentSummary.schemaVersion + 1,
    };
    const states = new Map<string, ChunkVisibilityState>([
      [chunkKey(0, 1, 0), state(transparentSummary)],
      [chunkKey(1, 1, 0), fallbackState(incompatibleSummary, TEST_REVISION + 1)],
      [chunkKey(2, 1, 0), state(opaqueSummary)],
    ]);

    const result = new ChunkVisibilityResolver().resolve(createResolverInput(states));

    expect(result.directVisible.has(chunkKey(2, 1, 0))).toBe(false);
    expect(result.active.has(chunkKey(2, 1, 0))).toBe(true);
    expect(result.active.has(chunkKey(3, 1, 0))).toBe(false);
  });

  test('the synchronous fallback may traverse an incompatible summary conservatively', () => {
    const incompatibleSummary = {
      ...transparentSummary,
      schemaVersion: transparentSummary.schemaVersion + 1,
    };
    const states = new Map<string, ChunkVisibilityState>([
      [chunkKey(0, 1, 0), state(transparentSummary)],
      [chunkKey(1, 1, 0), fallbackState(incompatibleSummary, TEST_REVISION + 1)],
      [chunkKey(2, 1, 0), state(opaqueSummary)],
    ]);

    const result = new ChunkVisibilityResolver().resolve({
      ...createResolverInput(states),
      allowUnknownTraversal: true,
    });

    expect(result.directVisible.has(chunkKey(2, 1, 0))).toBe(true);
  });

  test('far chunks behind the camera are rejected while forward chunks remain candidates', () => {
    const view: ChunkStreamingView = {
      position: { x: 8, y: 24, z: 8 },
      forward: { x: 1, y: 0, z: 0 },
      verticalFovRadians: Math.PI / 3,
      aspect: 1,
    };
    const result = new ChunkVisibilityResolver().resolve(createResolverInput(
      new Map(),
      { view, fallback: state(transparentSummary) },
    ));

    expect(result.directVisible.has(chunkKey(3, 1, 0))).toBe(true);
    expect(result.active.has(chunkKey(-3, 1, 0))).toBe(false);
  });

  test('uses rectangular frustum planes for a wide view instead of an enclosing cone', () => {
    const view: ChunkStreamingView = {
      position: { x: 8, y: 24, z: 8 },
      forward: { x: 1, y: 0, z: 0 },
      verticalFovRadians: Math.PI / 3,
      aspect: 4,
    };
    const result = new ChunkVisibilityResolver().resolve(createResolverInput(
      new Map(),
      {
        radius: 10,
        view,
        fallback: state(transparentSummary),
        maxChunkYExclusive: 12,
      },
    ));
    const horizontallyVisible = chunkKey(7, 1, 7);
    const verticallyOutside = chunkKey(7, 8, 0);

    expect(result.directVisible.has(horizontallyVisible)).toBe(true);
    expect(result.directVisible.has(verticallyOutside)).toBe(false);
    expect(result.active.has(verticallyOutside)).toBe(false);
  });

  test.each([
    { aspect: 0, verticalFovRadians: Math.PI / 3 },
    { aspect: 1, verticalFovRadians: Number.NaN },
  ])('uses default frustum parameters for invalid FOV/aspect %#', (viewParameters) => {
    const result = new ChunkVisibilityResolver().resolve(createResolverInput(
      new Map(),
      {
        view: {
          position: { x: 8, y: 24, z: 8 },
          forward: { x: 1, y: 0, z: 0 },
          ...viewParameters,
        },
        fallback: state(transparentSummary),
      },
    ));

    // Defaults keep a real frustum: forward stays, behind the camera does not.
    expect(result.directVisible.has(chunkKey(3, 1, 0))).toBe(true);
    expect(result.directVisible.has(chunkKey(-3, 1, 0))).toBe(false);
  });

  test('does not admit the full radius when the forward vector is degenerate', () => {
    const result = new ChunkVisibilityResolver().resolve(createResolverInput(
      new Map(),
      {
        view: {
          position: { x: 8, y: 24, z: 8 },
          forward: { x: 0, y: 0, z: 0 },
          verticalFovRadians: Math.PI / 3,
          aspect: 1,
        },
        fallback: state(transparentSummary),
      },
    ));

    expect(result.directVisible.has(chunkKey(3, 1, 0))).toBe(false);
    expect(result.directVisible.has(chunkKey(-3, 1, 0))).toBe(false);
    // Near-sphere / always-available still covers the player neighborhood.
    expect(result.directVisible.has(chunkKey(0, 1, 0))).toBe(true);
    expect(result.directVisible.has(chunkKey(1, 1, 0))).toBe(true);
  });

  test('direct and buffered visibility never escape the configured world Y bounds', () => {
    const result = new ChunkVisibilityResolver().resolve(createResolverInput(
      new Map(),
      {
        center: { x: 0, y: 0, z: 0 },
        radius: 1,
        fallback: state(transparentSummary),
        minChunkY: 0,
        maxChunkYExclusive: 2,
      },
    ));

    for (const key of result.active) {
      const y = Number(key.split(',')[1]);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(2);
    }
  });
});
