import * as THREE from 'three';
import { getBlockProperties } from '@game/world/BlockConfig';
import type { FallingVoxelBody } from './FallingVoxelSimulation';
import type { FallingVoxelViewPort } from './DynamicMaterialSystem';

const FALLING_VOXEL_SIZE = 0.96;
const INSTANCES_PER_MATERIAL = 256;

interface MaterialInstances {
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.MeshStandardMaterial;
}

export class ThreeFallingVoxelView implements FallingVoxelViewPort {
  private readonly parent: THREE.Object3D;
  private readonly geometry = new THREE.BoxGeometry(
    FALLING_VOXEL_SIZE,
    FALLING_VOXEL_SIZE,
    FALLING_VOXEL_SIZE,
  );
  private readonly resources = new Map<number, MaterialInstances>();
  private readonly transform = new THREE.Object3D();

  public constructor(parent: THREE.Object3D) {
    this.parent = parent;
  }

  public sync(bodies: Iterable<FallingVoxelBody>): void {
    for (const resource of this.resources.values()) {
      resource.mesh.count = 0;
    }

    for (const body of bodies) {
      const resource = this.getOrCreateResource(body.blockId);
      const instanceIndex = resource.mesh.count;
      if (instanceIndex >= INSTANCES_PER_MATERIAL) continue;

      this.transform.position.set(body.x + 0.5, body.positionY, body.z + 0.5);
      this.transform.updateMatrix();
      resource.mesh.setMatrixAt(instanceIndex, this.transform.matrix);
      resource.mesh.count = instanceIndex + 1;
    }

    for (const resource of this.resources.values()) {
      resource.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    for (const resource of this.resources.values()) {
      this.parent.remove(resource.mesh);
      resource.material.dispose();
    }
    this.resources.clear();
    this.geometry.dispose();
  }

  private getOrCreateResource(blockId: number): MaterialInstances {
    const existing = this.resources.get(blockId);
    if (existing) return existing;

    const properties = getBlockProperties(blockId);
    const material = new THREE.MeshStandardMaterial({
      color: properties.colorHex ?? 0xffffff,
      roughness: properties.roughness ?? 0.9,
      metalness: properties.metalness ?? 0,
    });
    const mesh = new THREE.InstancedMesh(
      this.geometry,
      material,
      INSTANCES_PER_MATERIAL,
    );
    mesh.name = `dynamic-material:${blockId}`;
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.parent.add(mesh);

    const created = { mesh, material };
    this.resources.set(blockId, created);
    return created;
  }
}
