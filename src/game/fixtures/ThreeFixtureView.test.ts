import * as THREE from 'three';
import { describe, expect, test, vi } from 'vitest';
import { TEST_CHEST_FIXTURE_DEFINITION as chestDefinition } from './FixtureTestFixtures';
import { ThreeFixtureView } from './ThreeFixtureView';

describe('ThreeFixtureView', () => {
  test('reuses one raycast object list across stable frames and lifecycle changes', () => {
    const view = new ThreeFixtureView(new THREE.Scene());
    const raycastObjects = view.getRaycastObjects();

    expect(view.getRaycastObjects()).toBe(raycastObjects);

    view.attach({
      id: 'fixture-stable-list',
      definitionId: chestDefinition.id,
      anchor: { x: 1, y: 2, z: 3 },
      orientation: 0,
      components: [],
    }, { ...chestDefinition, view: { color: 0x885522 } });

    expect(view.getRaycastObjects()).toBe(raycastObjects);
    expect(raycastObjects).toHaveLength(1);

    view.detach('fixture-stable-list');
    expect(view.getRaycastObjects()).toBe(raycastObjects);
    expect(raycastObjects).toHaveLength(0);
    view.dispose();
  });

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
    }, { ...chestDefinition, view: { color: 0x885522, height: 0.9 } });
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

    const root = view.getRaycastObjects()[0];
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const meshMaterial = object.material;
      if (Array.isArray(meshMaterial)) {
        meshMaterial.forEach((material) => materials.add(material));
      } else {
        materials.add(meshMaterial);
      }
    });
    expect(geometries.size).toBeGreaterThan(0);
    expect(materials.size).toBeGreaterThan(0);

    const disposeGeometrySpies = Array.from(geometries).map((geometry) =>
      vi.spyOn(geometry, 'dispose'),
    );
    const disposeMaterialSpies = Array.from(materials).map((material) =>
      vi.spyOn(material, 'dispose'),
    );

    view.dispose();

    expect(scene.children).not.toContain(root);
    for (const spy of disposeGeometrySpies) {
      expect(spy).toHaveBeenCalledOnce();
    }
    for (const spy of disposeMaterialSpies) {
      expect(spy).toHaveBeenCalledOnce();
    }
  });

  test('builds a multi-mesh chest model when model is chest', () => {
    const scene = new THREE.Scene();
    const view = new ThreeFixtureView(scene);
    view.attach({
      id: 'fixture-chest-model',
      definitionId: chestDefinition.id,
      anchor: { x: 0, y: 0, z: 0 },
      orientation: 0,
      components: [],
    }, {
      ...chestDefinition,
      view: { color: 0x8b5a2b, model: 'chest' },
    });

    const root = view.getRaycastObjects()[0];
    let meshCount = 0;
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) meshCount += 1;
    });

    expect(meshCount).toBeGreaterThan(1);
    expect(root.position.y).toBe(0);
    view.dispose();
  });
});
