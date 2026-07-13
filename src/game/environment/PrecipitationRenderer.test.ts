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
});
