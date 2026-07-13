import * as THREE from 'three';
import type { Physics } from '@game/physics/Physics';
import type { ThreeFixtureView } from '@game/fixtures/ThreeFixtureView';
import type { WorldFixtureManager } from '@game/fixtures/WorldFixtureManager';
import type { FixtureOrientation } from '@game/fixtures/FixtureTypes';
import { describeFixtureInteraction } from '@game/fixtures/FixtureInteraction';
import { useGameStore } from '@store/useGameStore';
import {
  getFixtureOrientationFromDirection,
  resolveWorldInteractionTarget,
} from './WorldInteractionTarget';

export interface FixtureInteractionRuntime {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly physics: Pick<Physics, 'raycast'>;
  readonly fixtureView: Pick<ThreeFixtureView, 'raycast'>;
  readonly fixtures: Pick<WorldFixtureManager, 'get' | 'place' | 'remove'>;
}

export interface TargetedBlockInfo {
  readonly target: THREE.Vector3;
  readonly place: THREE.Vector3;
  readonly face: THREE.Vector3;
}

/** Coordinates nearest-target resolution and fixture-specific interactions. */
export class FixtureInteractionCoordinator {
  public targetedBlockInfo: TargetedBlockInfo | null = null;
  public targetedFixtureId: string | null = null;
  public readonly selectionBox: THREE.Mesh;

  private readonly runtime: FixtureInteractionRuntime;
  private readonly raycaster = new THREE.Raycaster();
  private readonly screenCenter = new THREE.Vector2(0, 0);
  private readonly cameraDirection = new THREE.Vector3();
  private readonly fixtureBounds = new THREE.Box3();
  private readonly fixtureBoundsCenter = new THREE.Vector3();
  private readonly fixtureBoundsSize = new THREE.Vector3();
  private disposed = false;

  public constructor(runtime: FixtureInteractionRuntime) {
    this.runtime = runtime;
    this.selectionBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.008, 1.008, 1.008),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      }),
    );
    this.selectionBox.visible = false;
    this.runtime.scene.add(this.selectionBox);
  }

  public updateTarget(maxDistance: number): void {
    this.raycaster.setFromCamera(this.screenCenter, this.runtime.camera);
    const direction = this.raycaster.ray.direction;
    const origin = this.raycaster.ray.origin;

    this.targetedBlockInfo = null;
    this.targetedFixtureId = null;
    this.selectionBox.visible = false;

    const voxelHit = this.runtime.physics.raycast(origin, direction, maxDistance);
    const fixtureHit = this.runtime.fixtureView.raycast(this.raycaster, maxDistance);
    const target = resolveWorldInteractionTarget(origin, direction, voxelHit, fixtureHit);

    if (target?.kind === 'fixture') {
      this.targetedFixtureId = target.hit.fixtureId;
      this.fixtureBounds.setFromObject(target.hit.object);
      this.fixtureBounds.getCenter(this.fixtureBoundsCenter);
      this.fixtureBounds.getSize(this.fixtureBoundsSize);
      this.selectionBox.position.copy(this.fixtureBoundsCenter);
      this.selectionBox.scale.copy(this.fixtureBoundsSize);
      this.selectionBox.visible = true;
      return;
    }

    if (target?.kind === 'voxel') {
      const hit = target.hit;
      this.targetedBlockInfo = {
        target: hit.target,
        place: hit.place,
        face: hit.face,
      };
      this.selectionBox.position.set(
        hit.target.x + 0.5,
        hit.target.y + 0.5,
        hit.target.z + 0.5,
      );
      this.selectionBox.scale.set(1, 1, 1);
      this.selectionBox.visible = true;
    }
  }

  public getPlacementOrientation(): FixtureOrientation {
    return getFixtureOrientationFromDirection(
      this.runtime.camera.getWorldDirection(this.cameraDirection),
    );
  }

  public handleInteraction(): boolean {
    if (!this.targetedFixtureId) return false;
    const fixture = this.runtime.fixtures.get(this.targetedFixtureId);
    if (!fixture) return false;

    const interaction = describeFixtureInteraction(fixture);
    const store = useGameStore.getState();
    if (interaction.kind === 'container') {
      store.openFixture(interaction.fixtureId, []);
      store.openChest(
        interaction.anchor.x,
        interaction.anchor.y,
        interaction.anchor.z,
        interaction.slots.slots,
      );
      return true;
    }
    if (interaction.kind === 'workbench') {
      store.openFixture(interaction.fixtureId, interaction.capabilities);
      store.openInventory();
      return true;
    }
    return false;
  }

  public removeTargetedFixture(): boolean {
    return this.targetedFixtureId !== null
      && this.runtime.fixtures.remove(this.targetedFixtureId);
  }

  public getPlacementPort(): Pick<WorldFixtureManager, 'place'> {
    return this.runtime.fixtures;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.runtime.scene.remove(this.selectionBox);
    this.selectionBox.geometry.dispose();
    if (Array.isArray(this.selectionBox.material)) {
      this.selectionBox.material.forEach(material => material.dispose());
    } else {
      this.selectionBox.material.dispose();
    }
  }
}
