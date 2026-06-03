import * as THREE from 'three';
import { BLOCK_TYPES, getBlockProperties } from './BlockConfig';
import { generateTextureAtlas } from './TextureAtlas';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from './World';
import type { World } from './World';

export class ChunkRenderer {
  private world: World;
  private textureAtlas: THREE.Texture;
  public materials: { solid: THREE.Material; transparent: THREE.Material };
  private chunkMeshes: Map<string, { solid: THREE.Mesh; transparent: THREE.Mesh }>;

  constructor(world: World) {
    this.world = world;
    this.chunkMeshes = new Map();

    // Create materials
    this.textureAtlas = generateTextureAtlas();
    
    this.materials = {
      solid: new THREE.MeshStandardMaterial({
        map: this.textureAtlas,
        roughness: 0.8,
        metalness: 0.1,
        transparent: false,
        side: THREE.FrontSide,
        shadowSide: THREE.FrontSide,
      }),
      transparent: new THREE.MeshStandardMaterial({
        map: this.textureAtlas,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false, // Prevents depth buffer issues with water
      }),
    };
  }

  public updateChunkMesh(cx: number, cz: number, chunks: Map<string, Uint8Array>): void {
    const key = `${cx},${cz}`;
    const chunk = chunks.get(key);
    if (!chunk) return; // Don't build empty/unloaded chunks

    // Remove old meshes if they exist
    this.removeChunkMesh(key);

    const solidGeom = new THREE.BufferGeometry();
    const transGeom = new THREE.BufferGeometry();

    const solidData = { positions: [] as number[], normals: [] as number[], uvs: [] as number[] };
    const transData = { positions: [] as number[], normals: [] as number[], uvs: [] as number[] };

    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartZ = cz * CHUNK_SIZE_Z;

    const eastChunk = chunks.get(`${cx + 1},${cz}`);
    const westChunk = chunks.get(`${cx - 1},${cz}`);
    const southChunk = chunks.get(`${cx},${cz + 1}`);
    const northChunk = chunks.get(`${cx},${cz - 1}`);

    const getNeighbor = (lx: number, ly: number, lz: number, dir: number[]): number => {
      const ny = ly + dir[1];
      if (ny < 0 || ny >= CHUNK_SIZE_Y) return BLOCK_TYPES.AIR;

      const nx = lx + dir[0];
      const nz = lz + dir[2];

      if (nx >= 0 && nx < CHUNK_SIZE_X && nz >= 0 && nz < CHUNK_SIZE_Z) {
        return chunk[nx + nz * CHUNK_SIZE_X + ny * CHUNK_SIZE_X * CHUNK_SIZE_Z];
      }

      let neighborChunk: Uint8Array | undefined;
      let nlx = nx;
      let nlz = nz;

      if (nx < 0) {
        neighborChunk = westChunk;
        nlx = CHUNK_SIZE_X - 1;
      } else if (nx >= CHUNK_SIZE_X) {
        neighborChunk = eastChunk;
        nlx = 0;
      } else if (nz < 0) {
        neighborChunk = northChunk;
        nlz = CHUNK_SIZE_Z - 1;
      } else if (nz >= CHUNK_SIZE_Z) {
        neighborChunk = southChunk;
        nlz = 0;
      }

      if (!neighborChunk) return BLOCK_TYPES.AIR;
      return neighborChunk[nlx + nlz * CHUNK_SIZE_X + ny * CHUNK_SIZE_X * CHUNK_SIZE_Z];
    };

    // Face definition helper variables
    // px, nx, py, ny, pz, nz
    const faces = [
      { dir: [1, 0, 0],  corners: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]], uvFace: 'side' },  // px
      { dir: [-1, 0, 0], corners: [[0,0,1], [0,1,1], [0,1,0], [0,0,0]], uvFace: 'side' },  // nx
      { dir: [0, 1, 0],  corners: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]], uvFace: 'top' },   // py
      { dir: [0, -1, 0], corners: [[0,0,1], [0,0,0], [1,0,0], [1,0,1]], uvFace: 'bottom' },// ny
      { dir: [0, 0, 1],  corners: [[1,0,1], [1,1,1], [0,1,1], [0,0,1]], uvFace: 'side' },  // pz
      { dir: [0, 0, -1], corners: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]], uvFace: 'side' },  // nz
    ];

    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          const rawBlockType = chunk[index];
          const blockType = rawBlockType & 0x3F;
          const orientation = rawBlockType >> 6; // 0: Y, 1: X, 2: Z

          if (blockType === BLOCK_TYPES.AIR) continue;

          const isTrans = getBlockProperties(blockType).opacity < 1.0;
          const data = isTrans ? transData : solidData;

          const wx = worldStartX + x;
          const wz = worldStartZ + z;

          for (const face of faces) {
            const neighbor = getNeighbor(x, y, z, face.dir);
            
            // Draw face if:
            // 1. Neighbor is air/transparent
            // 2. OR neighbor is the same transparent block (stops internal rendering of the same transparent type)
            let drawFace = false;
            if (this.world.isTransparent(neighbor)) {
              if (blockType === neighbor) {
                drawFace = false;
              } else {
                drawFace = true;
              }
            }

            if (drawFace) {
              // Add vertices
              const corners = face.corners;
              const v0 = [wx + corners[0][0], y + corners[0][1], wz + corners[0][2]];
              const v1 = [wx + corners[1][0], y + corners[1][1], wz + corners[1][2]];
              const v2 = [wx + corners[2][0], y + corners[2][1], wz + corners[2][2]];
              const v3 = [wx + corners[3][0], y + corners[3][1], wz + corners[3][2]];

              // Triangle 1
              data.positions.push(...v0, ...v1, ...v2);
              // Triangle 2
              data.positions.push(...v0, ...v2, ...v3);

              // Add normals
              for (let i = 0; i < 6; i++) {
                data.normals.push(...face.dir);
              }

              // Add UV coordinates mapping to the dynamic atlas
              // Atlas is 8x8 tiles, so each tile is 0.125 x 0.125
              let uvFace: 'top' | 'bottom' | 'side' = face.uvFace as 'top' | 'bottom' | 'side';
              let rotateUV = false;

              // 1. Process oriented logs (WOOD, BIRCH_WOOD, SPRUCE_WOOD) using orientation metadata
              const isLog = blockType === BLOCK_TYPES.WOOD || blockType === BLOCK_TYPES.BIRCH_WOOD || blockType === BLOCK_TYPES.SPRUCE_WOOD;
              if (isLog) {
                if (orientation === 1) { // X axis
                  const isXFace = face.dir[0] !== 0; // px (1,0,0) or nx (-1,0,0)
                  if (isXFace) {
                    uvFace = 'top';
                  } else {
                    uvFace = 'side';
                    rotateUV = true;
                  }
                } else if (orientation === 2) { // Z axis
                  const isZFace = face.dir[2] !== 0; // pz (0,0,1) or nz (0,0,-1)
                  if (isZFace) {
                    uvFace = 'top';
                  } else {
                    uvFace = 'side';
                    if (face.dir[0] !== 0) { // px or nx side face needs rotation
                      rotateUV = true;
                    }
                  }
                }
              }

              const atlasIndex = getBlockProperties(blockType).textureFaces?.[uvFace] ?? 3; // Default to stone if undefined
              
              const tx = atlasIndex % 8;
              const ty = 7 - Math.floor(atlasIndex / 8); // Invert Y for WebGL texture coordinate space
              
              const uMin = tx * 0.125;
              const uMax = (tx + 1) * 0.125;
              const vMin = ty * 0.125;
              const vMax = (ty + 1) * 0.125;

              // Map face corners to UV coordinates
              // corners sequence matches: v0, v1, v2, v3
              // UV coordinates for the face corners
              const uv0 = [uMin, vMin];
              const uv1 = [uMin, vMax];
              const uv2 = [uMax, vMax];
              const uv3 = [uMax, vMin];

              const finalUVs = rotateUV 
                ? [uv3, uv0, uv1, uv2] 
                : [uv0, uv1, uv2, uv3];

              data.uvs.push(
                ...finalUVs[0], ...finalUVs[1], ...finalUVs[2], // Triangle 1
                ...finalUVs[0], ...finalUVs[2], ...finalUVs[3]  // Triangle 2
              );
            }
          }
        }
      }
    }

    // Set solid geometry arrays
    if (solidData.positions.length > 0) {
      solidGeom.setAttribute('position', new THREE.Float32BufferAttribute(solidData.positions, 3));
      solidGeom.setAttribute('normal', new THREE.Float32BufferAttribute(solidData.normals, 3));
      solidGeom.setAttribute('uv', new THREE.Float32BufferAttribute(solidData.uvs, 2));
      solidGeom.computeBoundingSphere();
    }
    // Set transparent geometry arrays
    if (transData.positions.length > 0) {
      transGeom.setAttribute('position', new THREE.Float32BufferAttribute(transData.positions, 3));
      transGeom.setAttribute('normal', new THREE.Float32BufferAttribute(transData.normals, 3));
      transGeom.setAttribute('uv', new THREE.Float32BufferAttribute(transData.uvs, 2));
      transGeom.computeBoundingSphere();
    }

    const solidMesh = new THREE.Mesh(solidGeom, this.materials.solid);
    const transMesh = new THREE.Mesh(transGeom, this.materials.transparent);

    solidMesh.castShadow = true;
    solidMesh.receiveShadow = true;

    // Add to group
    this.world.group.add(solidMesh);
    this.world.group.add(transMesh);

    // Save references to meshes
    this.chunkMeshes.set(key, { solid: solidMesh, transparent: transMesh });
  }

  public removeChunkMesh(key: string): void {
    const oldMeshes = this.chunkMeshes.get(key);
    if (oldMeshes) {
      this.world.group.remove(oldMeshes.solid);
      this.world.group.remove(oldMeshes.transparent);
      oldMeshes.solid.geometry.dispose();
      oldMeshes.transparent.geometry.dispose();
      this.chunkMeshes.delete(key);
    }
  }

  public getChunkMeshes(): Map<string, { solid: THREE.Mesh; transparent: THREE.Mesh }> {
    return this.chunkMeshes;
  }

  public hasChunkMesh(key: string): boolean {
    return this.chunkMeshes.has(key);
  }

  public dispose(): void {
    for (const meshes of this.chunkMeshes.values()) {
      meshes.solid.geometry.dispose();
      meshes.transparent.geometry.dispose();
    }
    this.materials.solid.dispose();
    this.materials.transparent.dispose();
    this.textureAtlas.dispose();
  }
}
