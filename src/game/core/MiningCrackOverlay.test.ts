import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MiningCrackOverlay } from './MiningCrackOverlay';

const canvasContext = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
};

describe('MiningCrackOverlay', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('mounts one hidden mesh and updates its position and crack stage', () => {
    const scene = new THREE.Scene();
    const overlay = new MiningCrackOverlay(scene);
    const mesh = scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    const initialTexture = mesh.material.map;

    expect(scene.children).toEqual([mesh]);
    expect(mesh.visible).toBe(false);

    overlay.show(new THREE.Vector3(2, 3, 4), 0.65);

    expect(mesh.position.toArray()).toEqual([2.5, 3.5, 4.5]);
    expect(mesh.material.map).not.toBe(initialTexture);
    expect(mesh.visible).toBe(true);

    overlay.hide();
    expect(mesh.visible).toBe(false);
  });

  test('removes its mesh and disposes every owned GPU resource', () => {
    const scene = new THREE.Scene();
    const overlay = new MiningCrackOverlay(scene);
    const mesh = scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    const textures = Array.from({ length: 10 }, (_, stage) => {
      overlay.show(new THREE.Vector3(), stage / 10);
      return mesh.material.map as THREE.Texture;
    });
    const disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(mesh.material, 'dispose');
    const disposeTextures = textures.map(texture => vi.spyOn(texture, 'dispose'));

    overlay.dispose();

    expect(scene.children).not.toContain(mesh);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    disposeTextures.forEach(disposeTexture => {
      expect(disposeTexture).toHaveBeenCalledOnce();
    });
  });
});
