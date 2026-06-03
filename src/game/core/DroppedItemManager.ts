import * as THREE from 'three';
import { GameManager } from './GameManager';
import { getBlockProperties } from '@game/world/World';
import { BLOCK_FACES, type BlockType } from '@game/world/BlockConfig';
import { sound } from '@game/systems/Sound';
import { useGameStore } from '@store/useGameStore';

export class DroppedItemManager {
  private game: GameManager;
  private droppedItems: {
    id: string;
    type: BlockType;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    mesh: THREE.Mesh;
    onGround: boolean;
    spawnTime: number;
  }[] = [];

  constructor(game: GameManager) {
    this.game = game;
  }

  public update(dt: number) {
    const now = performance.now();
    const gravity = -18;

    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];

      // 1. Check pickup by player
      const dist = this.game.player.position.distanceTo(item.position);
      if (dist < 1.8) {
        const added = useGameStore.getState().addToHotbar(item.type, 1);
        if (added) {
          sound.playPickup();
          this.game.scene.remove(item.mesh);
          item.mesh.geometry.dispose();
          this.droppedItems.splice(i, 1);
          continue;
        }
      }

      // 2. Physics updates
      if (!item.onGround || item.velocity.lengthSq() > 0.001) {
        item.velocity.y += gravity * dt;
        item.velocity.y = Math.max(-20, item.velocity.y);

        item.velocity.x *= Math.max(0, 1 - 2 * dt);
        item.velocity.z *= Math.max(0, 1 - 2 * dt);

        // X axis
        item.position.x += item.velocity.x * dt;
        let box = this.getDroppedItemBox(item.position);
        let colliders = this.getDroppedItemColliders(box);
        for (const block of colliders) {
          const overlapX = Math.min(box.max.x - block.x, block.x + 1 - box.min.x);
          if (overlapX > 0) {
            if (item.velocity.x > 0) item.position.x -= overlapX;
            else if (item.velocity.x < 0) item.position.x += overlapX;
            item.velocity.x = 0;
            box = this.getDroppedItemBox(item.position);
          }
        }

        // Z axis
        item.position.z += item.velocity.z * dt;
        box = this.getDroppedItemBox(item.position);
        colliders = this.getDroppedItemColliders(box);
        for (const block of colliders) {
          const overlapZ = Math.min(box.max.z - block.z, block.z + 1 - box.min.z);
          if (overlapZ > 0) {
            if (item.velocity.z > 0) item.position.z -= overlapZ;
            else if (item.velocity.z < 0) item.position.z += overlapZ;
            item.velocity.z = 0;
            box = this.getDroppedItemBox(item.position);
          }
        }

        // Y axis
        item.position.y += item.velocity.y * dt;
        box = this.getDroppedItemBox(item.position);
        colliders = this.getDroppedItemColliders(box);
        item.onGround = false;
        for (const block of colliders) {
          const overlapY = Math.min(box.max.y - block.y, block.y + 1 - box.min.y);
          if (overlapY > 0) {
            if (item.velocity.y > 0) {
              item.position.y -= overlapY;
              item.velocity.y = 0;
            } else if (item.velocity.y < 0) {
              item.position.y += overlapY;
              item.velocity.y = 0;
              item.onGround = true;
            }
            box = this.getDroppedItemBox(item.position);
          }
        }

        if (item.position.y < 0) {
          item.position.y = 0;
          item.velocity.set(0, 0, 0);
          item.onGround = true;
        }
      }

      // 3. Render update: bobbing + rotation
      item.mesh.position.copy(item.position);
      
      const bobOffset = Math.sin((now - item.spawnTime) * 0.004) * 0.06;
      item.mesh.position.y += 0.15 + bobOffset;

      item.mesh.rotation.y += dt * 1.2;
      item.mesh.rotation.x = 0.15;
    }
  }

  public spawnItem(blockType: BlockType, pos: THREE.Vector3) {
    const isTrans = getBlockProperties(blockType).opacity < 1.0;
    const material = isTrans ? this.game.world.materials.transparent : this.game.world.materials.solid;
    
    const geometry = this.createBlockItemGeometry(blockType);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    mesh.position.copy(pos);
    this.game.scene.add(mesh);

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      2.5 + Math.random() * 1.5,
      (Math.random() - 0.5) * 1.5
    );

    this.droppedItems.push({
      id: Math.random().toString(36).substring(2, 9),
      type: blockType,
      position: pos.clone(),
      velocity,
      mesh,
      onGround: false,
      spawnTime: performance.now(),
    });
  }

  private getDroppedItemBox(pos: THREE.Vector3): THREE.Box3 {
    const size = 0.25;
    const half = size / 2;
    return new THREE.Box3(
      new THREE.Vector3(pos.x - half, pos.y, pos.z - half),
      new THREE.Vector3(pos.x + half, pos.y + size, pos.z + half)
    );
  }

  private getDroppedItemColliders(box: THREE.Box3): { x: number; y: number; z: number }[] {
    const colliders = [];
    const minX = Math.floor(box.min.x);
    const maxX = Math.floor(box.max.x);
    const minY = Math.floor(box.min.y);
    const maxY = Math.floor(box.max.y);
    const minZ = Math.floor(box.min.z);
    const maxZ = Math.floor(box.max.z);

    const eps = 1e-4;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = this.game.world.getBlock(x, y, z);
          if (getBlockProperties(id).isSolid) {
            const isIntersect = (
              box.min.x + eps < x + 1 &&
              box.max.x - eps > x &&
              box.min.y + eps < y + 1 &&
              box.max.y - eps > y &&
              box.min.z + eps < z + 1 &&
              box.max.z - eps > z
            );
            if (isIntersect) {
              colliders.push({ x, y, z });
            }
          }
        }
      }
    }
    return colliders;
  }

  private createBlockItemGeometry(blockType: BlockType): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    const size = 0.25;
    const h = size / 2;
    
    const faces = [
      { dir: [1, 0, 0],  corners: [[h,-h,-h], [h,h,-h], [h,h,h], [h,-h,h]], uvFace: 'side' },
      { dir: [-1, 0, 0], corners: [[-h,-h,h], [-h,h,h], [-h,h,-h], [-h,-h,-h]], uvFace: 'side' },
      { dir: [0, 1, 0],  corners: [[-h,h,-h], [-h,h,h], [h,h,h], [h,h,-h]], uvFace: 'top' },
      { dir: [0, -1, 0], corners: [[-h,-h,h], [-h,-h,-h], [h,-h,-h], [h,-h,h]], uvFace: 'bottom' },
      { dir: [0, 0, 1],  corners: [[h,-h,h], [h,h,h], [-h,h,h], [-h,-h,h]], uvFace: 'side' },
      { dir: [0, 0, -1], corners: [[-h,-h,-h], [-h,h,-h], [h,h,-h], [h,-h,-h]], uvFace: 'side' },
    ];

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (const face of faces) {
      const corners = face.corners;
      const v0 = corners[0];
      const v1 = corners[1];
      const v2 = corners[2];
      const v3 = corners[3];

      positions.push(...v0, ...v1, ...v2);
      positions.push(...v0, ...v2, ...v3);

      for (let i = 0; i < 6; i++) {
        normals.push(...face.dir);
      }

      const atlasIndex = BLOCK_FACES[blockType]?.[face.uvFace as 'top' | 'bottom' | 'side'] ?? 3;
      const tx = atlasIndex % 4;
      const ty = 3 - Math.floor(atlasIndex / 4);
      const uMin = tx * 0.25;
      const uMax = (tx + 1) * 0.25;
      const vMin = ty * 0.25;
      const vMax = (ty + 1) * 0.25;

      const uv0 = [uMin, vMin];
      const uv1 = [uMin, vMax];
      const uv2 = [uMax, vMax];
      const uv3 = [uMax, vMin];

      uvs.push(
        ...uv0, ...uv1, ...uv2,
        ...uv0, ...uv2, ...uv3
      );
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.computeBoundingSphere();
    geom.computeBoundingBox();

    return geom;
  }

  public dispose() {
    if (this.droppedItems) {
      this.droppedItems.forEach((item) => {
        this.game.scene.remove(item.mesh);
        if (item.mesh.geometry) item.mesh.geometry.dispose();
      });
      this.droppedItems = [];
    }
  }
}
