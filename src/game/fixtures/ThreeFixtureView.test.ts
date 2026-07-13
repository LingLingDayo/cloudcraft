import * as THREE from 'three';
import { describe, expect, test, vi } from 'vitest';
import { TEST_CHEST_FIXTURE_DEFINITION as chestDefinition } from './FixtureTestFixtures';
import { ThreeFixtureView } from './ThreeFixtureView';

describe('ThreeFixtureView', () => {
  test('attaches identifiable fixture meshes and removes them symmetrically', () => {
    const scene = new THREE.Scene();
    const view = new ThreeFixtureView(scene);
    const fixture = {
      id: 'fixture-view',
      definitionId: chestDefinition.id,
      anchor: { x: 1, y: 2, z: 3 },
      orientation: 0 as const,
      components: [],
    };

    view.attach(fixture, { ...chestDefinition, view: { color: 0x885522 } });

    expect(view.getRaycastObjects()).toHaveLength(1);
    expect(view.getRaycastObjects()[0].userData.fixtureId).toBe('fixture-view');
    expect(scene.children).toContain(view.getRaycastObjects()[0]);

    view.detach('fixture-view');
    expect(view.getRaycastObjects()).toHaveLength(0);
    view.dispose();
  });

  test('returns the nearest fixture hit within the interaction distance', () => {
    const scene = new THREE.Scene();
    const view = new ThreeFixtureView(scene);
    view.attach({
      id: 'fixture-raycast',
      definitionId: chestDefinition.id,
      anchor: { x: 1, y: 2, z: 3 },
      orientation: 0,
      components: [],
    }, { ...chestDefinition, view: { color: 0x885522 } });
    scene.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(1.5, 2.45, 0),
      new THREE.Vector3(0, 0, 1),
    );

    expect(view.raycast(raycaster, 5)).toMatchObject({ fixtureId: 'fixture-raycast' });
    expect(view.raycast(raycaster, 2)).toBeNull();
    view.dispose();
  });

  test('restores the raycaster range when intersection fails', () => {
    const view = new ThreeFixtureView(new THREE.Scene());
    const raycaster = new THREE.Raycaster();
    raycaster.far = 7;
    vi.spyOn(raycaster, 'intersectObjects').mockImplementation(() => {
      throw new Error('raycast failed');
    });

    expect(() => view.raycast(raycaster, 2)).toThrow('raycast failed');
    expect(raycaster.far).toBe(7);
    view.dispose();
  });

  test('disposes shared geometry and material resources with the view', () => {
    const scene = new THREE.Scene();
    const view = new ThreeFixtureView(scene);
    view.attach({
      id: 'fixture-dispose',
      definitionId: chestDefinition.id,
      anchor: { x: 1, y: 2, z: 3 },
      orientation: 0,
      components: [],
    }, { ...chestDefinition, view: { color: 0x885522 } });
    const mesh = view.getRaycastObjects()[0] as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >;
    const disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(mesh.material, 'dispose');

    view.dispose();

    expect(scene.children).not.toContain(mesh);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
