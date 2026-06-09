import * as THREE from 'three';
import { GameManager } from './GameManager';
import { getBlockProperties } from '@game/world/World';
import { sound } from '@game/systems/Sound';
import { useGameStore } from '@store/useGameStore';
import { ItemType } from '@type';
import { ItemRegistry } from '@game/item/ItemRegistry';
import { BlockItem } from '@game/item/Item';
import { VoxelCollider } from '@game/physics/voxel/VoxelCollider';

export class DroppedItemManager {
  private game: GameManager;
  private droppedItems: {
    id: string;
    type: ItemType;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    mesh: THREE.Mesh;
    onGround: boolean;
    spawnTime: number;
  }[] = [];
  /** 几何体缓存：同一 ItemType 复用同一个 BufferGeometry */
  private geometryCache = new Map<ItemType, THREE.BufferGeometry>();

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

        const { onGround } = VoxelCollider.resolveMove(
          this.game.world,
          item.position,
          item.velocity,
          { width: 0.2, height: 0.2, depth: 0.2 },
          dt
        );
        item.onGround = onGround;
      }

      // 3. Render update: bobbing + rotation
      item.mesh.position.copy(item.position);
      
      const bobOffset = Math.sin((now - item.spawnTime) * 0.004) * 0.06;
      item.mesh.position.y += 0.15 + bobOffset;

      item.mesh.rotation.y += dt * 1.2;
      item.mesh.rotation.x = 0.15;
    }
  }

  public spawnItem(itemType: ItemType, pos: THREE.Vector3 | { x: number; y: number; z: number }, count?: number) {
    void count;
    const item = ItemRegistry.get(itemType);
    let isTrans = true;
    if (item.isBlockItem) {
      const blockProps = getBlockProperties((item as BlockItem).blockId);
      isTrans = blockProps.opacity < 1.0;
    }
    
    const material = isTrans ? this.game.world.materials.transparent : this.game.world.materials.solid;
    
    const geometry = this.getOrCreateGeometry(itemType, item);
      
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    const spawnPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    mesh.position.copy(spawnPos);
    this.game.scene.add(mesh);

    const velocity = new THREE.Vector3(0, 0, 0);

    this.droppedItems.push({
      id: Math.random().toString(36).substring(2, 9),
      type: itemType,
      position: spawnPos,
      velocity,
      mesh,
      onGround: false,
      spawnTime: performance.now(),
    });
  }

  /** 从缓存获取或新建并缓存几何体 */
  private getOrCreateGeometry(itemType: ItemType, item: ReturnType<typeof ItemRegistry.get>): THREE.BufferGeometry {
    if (this.geometryCache.has(itemType)) {
      return this.geometryCache.get(itemType)!;
    }
    const geom = item.droppedModelType === 'cross'
      ? this.createCrossItemGeometry(itemType)
      : this.createBlockItemGeometry(itemType);
    this.geometryCache.set(itemType, geom);
    return geom;
  }

  private createCrossItemGeometry(itemType: ItemType): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    const size = 0.25;
    const h = size / 2;

    const positions: number[] = [
      // 面 1 (在 Z-Y 平面上，平行于 Z 轴，x = 0)
      0, -h, -h,
      0,  h, -h,
      0,  h,  h,
      0, -h, -h,
      0,  h,  h,
      0, -h,  h,

      // 面 2 (在 X-Y 平面上，平行于 X 轴，z = 0)
      -h, -h, 0,
      -h,  h, 0,
       h,  h, 0,
      -h, -h, 0,
       h,  h, 0,
       h, -h, 0,
    ];

    const normals: number[] = [
      // 面 1 的法线
      1, 0, 0, 1, 0, 0, 1, 0, 0,
      1, 0, 0, 1, 0, 0, 1, 0, 0,

      // 面 2 的法线
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ];

    const item = ItemRegistry.get(itemType);
    const blockProps = item.isBlockItem ? getBlockProperties((item as BlockItem).blockId) : null;
    const textureFaces = blockProps?.textureFaces ?? item.textureFaces;
    const atlasIndex = textureFaces?.side ?? textureFaces?.top ?? 3;
    const tx = atlasIndex % 8;
    const ty = 7 - Math.floor(atlasIndex / 8);
    const uMin = tx * 0.125;
    const uMax = (tx + 1) * 0.125;
    const vMin = ty * 0.125;
    const vMax = (ty + 1) * 0.125;

    const uvs: number[] = [
      // 面 1 (Z是水平，Y是垂直，Z: -h->uMin, h->uMax; Y: -h->vMin, h->vMax)
      uMin, vMin,
      uMin, vMax,
      uMax, vMax,
      uMin, vMin,
      uMax, vMax,
      uMax, vMin,

      // 面 2 (X是水平，Y是垂直，X: -h->uMin, h->uMax; Y: -h->vMin, h->vMax)
      uMin, vMin,
      uMin, vMax,
      uMax, vMax,
      uMin, vMin,
      uMax, vMax,
      uMax, vMin,
    ];

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.computeBoundingSphere();
    geom.computeBoundingBox();

    return geom;
  }

  private createBlockItemGeometry(itemType: ItemType): THREE.BufferGeometry {
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

    const item = ItemRegistry.get(itemType);
    const blockProps = item.isBlockItem ? getBlockProperties((item as BlockItem).blockId) : null;
    const textureFaces = blockProps?.textureFaces ?? item.textureFaces;

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

      const atlasIndex = textureFaces?.[face.uvFace as 'top' | 'bottom' | 'side'] ?? 3;
      const tx = atlasIndex % 8;
      const ty = 7 - Math.floor(atlasIndex / 8);
      const uMin = tx * 0.125;
      const uMax = (tx + 1) * 0.125;
      const vMin = ty * 0.125;
      const vMax = (ty + 1) * 0.125;

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

  public getCount(): number {
    return this.droppedItems.length;
  }

  public dispose() {
    if (this.droppedItems) {
      this.droppedItems.forEach((item) => {
        this.game.scene.remove(item.mesh);
        if (item.mesh.geometry) item.mesh.geometry.dispose();
      });
      this.droppedItems = [];
    }
    // 清理几何体缓存
    this.geometryCache.forEach((geom) => geom.dispose());
    this.geometryCache.clear();
  }
}
