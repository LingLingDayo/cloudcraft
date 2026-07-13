import { describe, expect, test } from 'vitest';
import { ChunkStreamingViewCache } from './ChunkStreamingViewCache';
import type { ChunkStreamingView } from './ChunkVisibilityResolver';

function createView(
  positionX: number,
  forwardX: number,
): ChunkStreamingView {
  return {
    position: { x: positionX, y: 17, z: 1 },
    forward: { x: forwardX, y: 0, z: -1 },
    verticalFovRadians: Math.PI / 3,
    aspect: 16 / 9,
  };
}

describe('ChunkStreamingViewCache', () => {
  test('resolves once for a stable signature and resolves again after invalidation', () => {
    const cache = new ChunkStreamingViewCache();
    const input = { centerX: 1, centerY: 2, centerZ: 3, radius: 4, view: null };

    expect(cache.shouldResolve(input)).toBe(true);
    expect(cache.shouldResolve(input)).toBe(false);

    cache.invalidate();
    expect(cache.shouldResolve(input)).toBe(true);
  });

  test('normalizes equivalent directions across the yaw wrap', () => {
    const cache = new ChunkStreamingViewCache();
    const base = { centerX: 0, centerY: 1, centerZ: 0, radius: 2 };

    expect(cache.shouldResolve({ ...base, view: createView(1, 0.000_001) })).toBe(true);
    expect(cache.shouldResolve({ ...base, view: createView(1, -0.000_001) })).toBe(false);
  });

  test('resolves only after the camera crosses a position bucket', () => {
    const cache = new ChunkStreamingViewCache();
    const base = { centerX: 0, centerY: 1, centerZ: 0, radius: 2 };

    expect(cache.shouldResolve({ ...base, view: createView(1, 0) })).toBe(true);
    expect(cache.shouldResolve({ ...base, view: createView(3, 0) })).toBe(false);
    expect(cache.shouldResolve({ ...base, view: createView(4, 0) })).toBe(true);
  });
});
