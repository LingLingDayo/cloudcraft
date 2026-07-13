import * as THREE from 'three';
import type {
  FixtureDefinition,
  FixtureRaycastHit,
  FixtureViewPort,
  PlacedFixture,
} from './FixtureTypes';

interface FixtureViewResources {
  readonly geometry: THREE.BoxGeometry;
  readonly material: THREE.MeshStandardMaterial;
}

export class ThreeFixtureView implements FixtureViewPort {
  private readonly scene: THREE.Scene;
  private readonly objects = new Map<string, THREE.Object3D>();
  private readonly resources = new Map<string, FixtureViewResources>();

  public constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public attach(fixture: PlacedFixture, definition: FixtureDefinition): void {
    this.detach(fixture.id);
    const view = definition.view ?? { color: 0x777777 };
    const width = view.width ?? 0.9;
    const height = view.height ?? 0.9;
    const depth = view.depth ?? 0.9;

    let resources = this.resources.get(definition.id);
    if (!resources) {
      resources = {
        geometry: new THREE.BoxGeometry(width, height, depth),
        material: new THREE.MeshStandardMaterial({
          color: view.color,
          roughness: 0.82,
          metalness: definition.id === 'cloudcraft:furnace' ? 0.22 : 0.05,
        }),
      };
      this.resources.set(definition.id, resources);
    }

    const mesh = new THREE.Mesh(resources.geometry, resources.material);
    mesh.name = `fixture:${fixture.definitionId}`;
    mesh.position.set(
      fixture.anchor.x + 0.5,
      fixture.anchor.y + height / 2,
      fixture.anchor.z + 0.5,
    );
    mesh.rotation.y = fixture.orientation * Math.PI * 0.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.fixtureId = fixture.id;
    this.scene.add(mesh);
    this.objects.set(fixture.id, mesh);
  }

  public detach(fixtureId: string): void {
    const object = this.objects.get(fixtureId);
    if (!object) return;
    this.scene.remove(object);
    this.objects.delete(fixtureId);
  }

  public getRaycastObjects(): THREE.Object3D[] {
    return Array.from(this.objects.values());
  }

  public getFixtureIdFromObject(object: THREE.Object3D): string | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      const fixtureId = current.userData.fixtureId;
      if (typeof fixtureId === 'string') return fixtureId;
      current = current.parent;
    }
    return undefined;
  }

  public raycast(raycaster: THREE.Raycaster, maxDistance: number): FixtureRaycastHit | null {
    const previousFar = raycaster.far;
    raycaster.far = Math.min(previousFar, maxDistance);
    try {
      const intersections = raycaster.intersectObjects(this.getRaycastObjects(), true);
      for (const intersection of intersections) {
        const fixtureId = this.getFixtureIdFromObject(intersection.object);
        if (fixtureId) {
          return {
            fixtureId,
            distance: intersection.distance,
            point: intersection.point.clone(),
            object: intersection.object,
          };
        }
      }
      return null;
    } finally {
      raycaster.far = previousFar;
    }
  }

  public dispose(): void {
    for (const fixtureId of Array.from(this.objects.keys())) {
      this.detach(fixtureId);
    }
    for (const resource of this.resources.values()) {
      resource.geometry.dispose();
      resource.material.dispose();
    }
    this.resources.clear();
  }
}
