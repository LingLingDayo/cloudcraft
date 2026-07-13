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

    expect(cache.shouldResolve(1, 2, 3, 4, null)).toBe(true);
    expect(cache.shouldResolve(1, 2, 3, 4, null)).toBe(false);

    cache.invalidate();
    expect(cache.shouldResolve(1, 2, 3, 4, null)).toBe(true);
  });

  test('normalizes equivalent directions across the yaw wrap', () => {
    const cache = new ChunkStreamingViewCache();
    expect(cache.shouldResolve(0, 1, 0, 2, createView(1, 0.000_001))).toBe(true);
    expect(cache.shouldResolve(0, 1, 0, 2, createView(1, -0.000_001))).toBe(false);
  });

  test('resolves only after the camera crosses a position bucket', () => {
    const cache = new ChunkStreamingViewCache();
    expect(cache.shouldResolve(0, 1, 0, 2, createView(1, 0))).toBe(true);
    expect(cache.shouldResolve(0, 1, 0, 2, createView(3, 0))).toBe(false);
    expect(cache.shouldResolve(0, 1, 0, 2, createView(4, 0))).toBe(true);
  });
});
