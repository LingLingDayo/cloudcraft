import * as THREE from 'three';

const CRACK_TEXTURE_SIZE = 16;
const CRACK_MESH_SIZE = 1.002;
const CRACK_STAGE_COUNT = 10;
const BLOCK_CENTER_OFFSET = 0.5;
const CRACK_SEGMENTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [2, 3, 6, 8],
  [6, 8, 11, 4],
  [11, 4, 14, 11],
  [6, 8, 5, 13],
  [5, 13, 2, 12],
  [11, 4, 9, 2],
  [2, 3, 4, 1],
  [14, 11, 15, 14],
  [5, 13, 9, 13],
  [9, 13, 13, 9],
];

interface BlockPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Owns the mining crack mesh, its stage textures and their GPU lifecycle. */
export class MiningCrackOverlay {
  private readonly scene: THREE.Scene;
  private readonly textures: THREE.CanvasTexture[];
  private readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private disposed = false;

  public constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.textures = this.createTextures();
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(CRACK_MESH_SIZE, CRACK_MESH_SIZE, CRACK_MESH_SIZE),
      new THREE.MeshBasicMaterial({
        map: this.textures[0],
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  public show(target: BlockPosition, progress: number): void {
    if (this.disposed) throw new Error('Mining crack overlay has been disposed');

    const normalizedProgress = Number.isFinite(progress)
      ? Math.min(1, Math.max(0, progress))
      : 0;
    const stage = Math.min(
      CRACK_STAGE_COUNT - 1,
      Math.floor(normalizedProgress * CRACK_STAGE_COUNT),
    );
    this.mesh.position.set(
      target.x + BLOCK_CENTER_OFFSET,
      target.y + BLOCK_CENTER_OFFSET,
      target.z + BLOCK_CENTER_OFFSET,
    );
    this.mesh.material.map = this.textures[stage];
    this.mesh.visible = true;
  }

  public hide(): void {
    this.mesh.visible = false;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.mesh);
    this.textures.forEach(texture => texture.dispose());
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private createTextures(): THREE.CanvasTexture[] {
    return Array.from({ length: CRACK_STAGE_COUNT }, (_, stageIndex) => {
      const canvas = document.createElement('canvas');
      canvas.width = CRACK_TEXTURE_SIZE;
      canvas.height = CRACK_TEXTURE_SIZE;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to create mining crack canvas context');

      context.clearRect(0, 0, CRACK_TEXTURE_SIZE, CRACK_TEXTURE_SIZE);
      context.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      context.lineWidth = 1;
      context.lineCap = 'square';
      context.beginPath();
      for (let segmentIndex = 0; segmentIndex <= stageIndex; segmentIndex += 1) {
        const [startX, startY, endX, endY] = CRACK_SEGMENTS[segmentIndex];
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
      }
      context.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      return texture;
    });
  }
}
