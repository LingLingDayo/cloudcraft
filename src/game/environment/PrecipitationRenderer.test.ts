import { describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import {
  PRECIPITATION_CONFIG,
  PrecipitationRenderer,
} from './PrecipitationRenderer';

describe('PrecipitationRenderer', () => {
  test('reuses one fixed position buffer for camera-local rain and storm', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const precipitation = new PrecipitationRenderer(scene, camera, 'test-precipitation-seed');
    const lines = scene.children[0] as THREE.LineSegments<THREE.BufferGeometry>;
    const position = lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positionArray = position.array;

    camera.position.set(12, 34, 56);
    precipitation.update(0.016, 'rain');

    expect(lines.visible).toBe(true);
    expect(lines.position).toEqual(camera.position);
    expect(lines.geometry.drawRange.count).toBe(PRECIPITATION_CONFIG.rain.dropCount * 2);

    precipitation.update(0.016, 'storm');

    expect(lines.geometry.getAttribute('position').array).toBe(positionArray);
    expect(lines.geometry.drawRange.count).toBe(PRECIPITATION_CONFIG.storm.dropCount * 2);
    expect(PRECIPITATION_CONFIG.storm.dropCount)
      .toBeGreaterThan(PRECIPITATION_CONFIG.rain.dropCount);

    precipitation.update(0.016, 'clear');
    expect(lines.visible).toBe(false);
    expect(lines.geometry.drawRange.count).toBe(0);
  });

  test('removes its object and disposes geometry and material symmetrically', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const precipitation = new PrecipitationRenderer(scene, camera, 'test-dispose-seed');
    const lines = scene.children[0] as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    const geometryDispose = vi.spyOn(lines.geometry, 'dispose');
    const materialDispose = vi.spyOn(lines.material, 'dispose');

    precipitation.dispose();

    expect(scene.children).not.toContain(lines);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  test.each(['rain', 'storm'] as const)(
    'keeps every position finite when %s receives a non-finite delta',
    weatherId => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const precipitation = new PrecipitationRenderer(
        scene,
        camera,
        'test-invalid-delta-seed',
      );
      const lines = scene.children[0] as THREE.LineSegments<THREE.BufferGeometry>;

      precipitation.update(Number.NaN, weatherId);

      const positions = lines.geometry.getAttribute('position').array;
      expect(Array.from(positions).every(Number.isFinite)).toBe(true);
    },
  );

  test.each(['rain', 'storm'] as const)(
    'drifts %s drops along the streak wind direction instead of pure vertical fall',
    weatherId => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const precipitation = new PrecipitationRenderer(
        scene,
        camera,
        'test-wind-drift-seed',
      );
      const lines = scene.children[0] as THREE.LineSegments<THREE.BufferGeometry>;
      const positions = lines.geometry.getAttribute('position').array as Float32Array;
      const mode = PRECIPITATION_CONFIG[weatherId];
      const sampleIndex = 0;
      const offset = sampleIndex * 6;

      // Force a mid-air sample so the next frame cannot hit the respawn path.
      const startX = 0;
      const startY = 4;
      const startZ = 0;
      positions[offset] = startX;
      positions[offset + 1] = startY;
      positions[offset + 2] = startZ;
      positions[offset + 3] = startX + mode.windOffset;
      positions[offset + 4] = startY - mode.streakLength;
      positions[offset + 5] = startZ;

      const deltaSeconds = 0.05;
      precipitation.update(deltaSeconds, weatherId);

      const nextX = positions[offset];
      const nextY = positions[offset + 1];
      const fallDistance = startY - nextY;

      expect(fallDistance).toBeGreaterThan(0);
      expect(nextX).toBeGreaterThan(startX);
      expect(nextX - startX).toBeCloseTo(
        fallDistance * (mode.windOffset / mode.streakLength),
        5,
      );
      expect(positions[offset + 3]).toBeCloseTo(nextX + mode.windOffset, 5);
      expect(positions[offset + 4]).toBeCloseTo(nextY - mode.streakLength, 5);
      expect(positions[offset + 2]).toBe(startZ);
      expect(positions[offset + 5]).toBe(startZ);
    },
  );
});
