import * as THREE from 'three';
import type {
  FixtureDefinition,
  FixtureRaycastHit,
  FixtureViewPort,
  PlacedFixture,
} from './FixtureTypes';
import {
  createFixtureModelPrototype,
  disposeFixtureModelTree,
} from './FixtureModels';

export class ThreeFixtureView implements FixtureViewPort {
  private readonly scene: THREE.Scene;
  private readonly objects = new Map<string, THREE.Object3D>();
  private readonly raycastObjects: THREE.Object3D[] = [];
  /** 按 definitionId 缓存原型，实例通过 clone 共享 geometry/material */
  private readonly prototypes = new Map<string, THREE.Object3D>();

  public constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public attach(fixture: PlacedFixture, definition: FixtureDefinition): void {
    this.detach(fixture.id);

    let prototype = this.prototypes.get(definition.id);
    if (!prototype) {
      prototype = createFixtureModelPrototype(definition);
      this.prototypes.set(definition.id, prototype);
    }

    const object = prototype.clone(true);
    object.name = `fixture:${fixture.definitionId}`;
    // 模型局部原点在底面中心
    object.position.set(
      fixture.anchor.x + 0.5,
      fixture.anchor.y,
      fixture.anchor.z + 0.5,
    );
    object.rotation.y = fixture.orientation * Math.PI * 0.5;
    object.userData.fixtureId = fixture.id;
    object.traverse((child) => {
      child.userData.fixtureId = fixture.id;
    });

    this.scene.add(object);
    this.objects.set(fixture.id, object);
    this.raycastObjects.push(object);
  }

  public detach(fixtureId: string): void {
    const object = this.objects.get(fixtureId);
    if (!object) return;
    this.scene.remove(object);
    this.objects.delete(fixtureId);
    const raycastIndex = this.raycastObjects.indexOf(object);
    if (raycastIndex >= 0) this.raycastObjects.splice(raycastIndex, 1);
  }

  public getRaycastObjects(): readonly THREE.Object3D[] {
    return this.raycastObjects;
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
      const intersections = raycaster.intersectObjects(this.raycastObjects, true);
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
    for (const prototype of this.prototypes.values()) {
      disposeFixtureModelTree(prototype);
    }
    this.prototypes.clear();
  }
}
