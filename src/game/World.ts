import * as THREE from 'three';
import { ImprovedNoise } from './Noise';
import { BLOCK_TYPES, BLOCK_FACES } from './BlockConfig';
import { generateTextureAtlas } from './TextureAtlas';

export { BLOCK_TYPES };

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 64;

export class World {
  private chunks: Map<string, Uint8Array>;
  private noise: ImprovedNoise;
  private seed: string;
  private textureAtlas: THREE.Texture;
  public group: THREE.Group;
  private chunkMeshes: Map<string, { solid: THREE.Mesh; transparent: THREE.Mesh }>;
  public materials: { solid: THREE.Material; transparent: THREE.Material };

  constructor(seed = 'minicraft') {
    this.seed = seed;
    this.chunks = new Map();
    this.noise = new ImprovedNoise(seed);
    this.group = new THREE.Group();
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

  // Get chunk coordinates from world coordinates
  public getChunkKey(x: number, z: number): string {
    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    return `${cx},${cz}`;
  }

  // Get block at global x, y, z
  public getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= CHUNK_SIZE_Y) return BLOCK_TYPES.AIR;

    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    const key = `${cx},${cz}`;

    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunkData(cx, cz);
    }

    const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    const index = lx + lz * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;

    return chunk[index];
  }

  // Set block at global x, y, z
  public setBlock(x: number, y: number, z: number, type: number) {
    if (y < 0 || y >= CHUNK_SIZE_Y) return;

    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    const key = `${cx},${cz}`;

    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunkData(cx, cz);
    }

    const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    const index = lx + lz * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;

    const oldType = chunk[index];
    if (oldType === type) return;

    chunk[index] = type;
    this.chunks.set(key, chunk);

    // Rebuild this chunk's mesh
    this.updateChunkMesh(cx, cz);

    // If block is on the edge of the chunk, update neighbor chunks too
    if (lx === 0) this.updateChunkMesh(cx - 1, cz);
    if (lx === CHUNK_SIZE_X - 1) this.updateChunkMesh(cx + 1, cz);
    if (lz === 0) this.updateChunkMesh(cx, cz - 1);
    if (lz === CHUNK_SIZE_Z - 1) this.updateChunkMesh(cx, cz + 1);
  }

  // Procedural chunk generation
  private generateChunkData(cx: number, cz: number): Uint8Array {
    const key = `${cx},${cz}`;
    const chunk = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y);
    this.chunks.set(key, chunk);

    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartZ = cz * CHUNK_SIZE_Z;

    // Generate terrain
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        const wx = worldStartX + x;
        const wz = worldStartZ + z;

        // Use noise to generate height
        // Base terrain
        const baseHeight = Math.floor(this.noise.fbm(wx * 0.015, wz * 0.015, 3, 0.4) * 20 + 25);
        // Mountains
        const mountainNoise = this.noise.noise(wx * 0.005, wz * 0.005);
        const mountainHeight = mountainNoise > 0.1 ? Math.floor(mountainNoise * 25) : 0;
        
        const finalHeight = Math.min(CHUNK_SIZE_Y - 2, baseHeight + mountainHeight);
        const waterLevel = 22;

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          
          if (y === 0) {
            // Bedrock layer
            chunk[index] = BLOCK_TYPES.STONE;
          } else if (y <= finalHeight) {
            if (y === finalHeight) {
              if (y < waterLevel + 2) {
                chunk[index] = BLOCK_TYPES.SAND; // Sandy shores
              } else {
                chunk[index] = BLOCK_TYPES.GRASS; // Grassy surface
              }
            } else if (y > finalHeight - 4) {
              if (y < waterLevel + 2) {
                chunk[index] = BLOCK_TYPES.SAND;
              } else {
                chunk[index] = BLOCK_TYPES.DIRT;
              }
            } else {
              // Deep stone with ore veins
              const r = Math.random();
              if (r < 0.01 && y < 15) {
                chunk[index] = BLOCK_TYPES.DIAMOND;
              } else if (r < 0.02 && y < 30) {
                chunk[index] = BLOCK_TYPES.IRON;
              } else if (r < 0.04 && y < 45) {
                chunk[index] = BLOCK_TYPES.COAL;
              } else {
                chunk[index] = BLOCK_TYPES.STONE;
              }
            }
          } else if (y <= waterLevel) {
            // Water filling
            chunk[index] = BLOCK_TYPES.WATER;
          } else {
            // Air
            chunk[index] = BLOCK_TYPES.AIR;
          }
        }
      }
    }

    // Procedural decoration: grow trees in this chunk (only if surface is grass)
    // Seeded random for trees based on chunk coordinates
    let r = Math.abs((cx * 12345 + cz * 678910) % 100) / 100;
    if (r < 0.35) { // 35% chance to have trees in a chunk
      const numTrees = Math.floor(r * 4) + 1; // 1 to 4 trees
      for (let t = 0; t < numTrees; t++) {
        // Tree position (leave padding so trees don't overlap chunk boundaries easily)
        const tx = 2 + Math.floor(((r * 32423 + t * 4392) % 1) * (CHUNK_SIZE_X - 4));
        const tz = 2 + Math.floor(((r * 87424 + t * 7623) % 1) * (CHUNK_SIZE_Z - 4));
        // Find surface height
        let ty = CHUNK_SIZE_Y - 2;
        while (ty > 0 && chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z] === BLOCK_TYPES.AIR) {
          ty--;
        }

        const blockType = chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z];
        if (blockType === BLOCK_TYPES.GRASS && ty > 22) {
          // Change grass below trunk to dirt
          chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z] = BLOCK_TYPES.DIRT;

          // Grow trunk (4 to 5 blocks)
          const treeHeight = 4 + Math.floor(((r * 9831 + t * 711) % 1) * 2);
          for (let h = 1; h <= treeHeight; h++) {
            const trunkIdx = tx + tz * CHUNK_SIZE_X + (ty + h) * CHUNK_SIZE_X * CHUNK_SIZE_Z;
            chunk[trunkIdx] = BLOCK_TYPES.WOOD;
          }

          // Grow canopy (leaves)
          const leafCenterY = ty + treeHeight;
          for (let ly = -2; ly <= 1; ly++) {
            const radius = ly === 1 ? 1 : ly === 0 ? 2 : 2;
            for (let lx = -radius; lx <= radius; lx++) {
              for (let lz = -radius; lz <= radius; lz++) {
                // Avoid placing leaves directly where trunk is, or outside chunk bounds easily
                if (lx === 0 && lz === 0 && ly > 0) continue;
                
                const wlx = tx + lx;
                const wlz = tz + lz;
                const wly = leafCenterY + ly;

                if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < CHUNK_SIZE_Y) {
                  const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
                  if (chunk[leafIdx] === BLOCK_TYPES.AIR) {
                    chunk[leafIdx] = BLOCK_TYPES.LEAF;
                  }
                }
              }
            }
          }
        }
      }
    }

    return chunk;
  }

  // Check if a block is transparent (allows face rendering behind it)
  public isTransparent(blockType: number): boolean {
    return (
      blockType === BLOCK_TYPES.AIR ||
      blockType === BLOCK_TYPES.WATER ||
      blockType === BLOCK_TYPES.GLASS
    );
  }

  // Update or create chunk meshes
  public updateChunkMesh(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    let chunk = this.chunks.get(key);
    if (!chunk) return; // Don't build empty/unloaded chunks

    // Remove old meshes if they exist
    const oldMeshes = this.chunkMeshes.get(key);
    if (oldMeshes) {
      this.group.remove(oldMeshes.solid);
      this.group.remove(oldMeshes.transparent);
      oldMeshes.solid.geometry.dispose();
      oldMeshes.transparent.geometry.dispose();
    }

    const solidGeom = new THREE.BufferGeometry();
    const transGeom = new THREE.BufferGeometry();

    const solidData = { positions: [] as number[], normals: [] as number[], uvs: [] as number[] };
    const transData = { positions: [] as number[], normals: [] as number[], uvs: [] as number[] };

    const worldStartX = cx * CHUNK_SIZE_X;
    const worldStartZ = cz * CHUNK_SIZE_Z;

    // Face definition helper variables
    // px, nx, py, ny, pz, nz
    const faces = [
      { dir: [1, 0, 0],  corners: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]], uvFace: 'side' },  // px
      { dir: [-1, 0, 0], corners: [[0,0,1], [0,1,1], [0,1,0], [0,0,0]], uvFace: 'side' },  // nx
      { dir: [0, 1, 0],  corners: [[0,1,1], [0,1,0], [1,1,0], [1,1,1]], uvFace: 'top' },   // py
      { dir: [0, -1, 0], corners: [[0,0,0], [0,0,1], [1,0,1], [1,0,0]], uvFace: 'bottom' },// ny
      { dir: [0, 0, 1],  corners: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]], uvFace: 'side' },  // pz
      { dir: [0, 0, -1], corners: [[1,0,0], [0,0,0], [0,1,0], [1,1,0]], uvFace: 'side' },  // nz
    ];

    for (let x = 0; x < CHUNK_SIZE_X; x++) {
      for (let z = 0; z < CHUNK_SIZE_Z; z++) {
        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          const index = x + z * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
          const blockType = chunk[index];

          if (blockType === BLOCK_TYPES.AIR) continue;

          const isTrans = blockType === BLOCK_TYPES.WATER || blockType === BLOCK_TYPES.GLASS;
          const data = isTrans ? transData : solidData;

          const wx = worldStartX + x;
          const wz = worldStartZ + z;

          for (const face of faces) {
            const nx = wx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = wz + face.dir[2];

            const neighbor = this.getBlock(nx, ny, nz);
            
            // Draw face if:
            // 1. Neighbor is air/transparent
            // 2. OR neighbor is Water and this is not Water (stops water rendering internal water faces)
            // 3. OR neighbor is Glass and this is not Glass (stops glass internal rendering)
            let drawFace = false;
            if (this.isTransparent(neighbor)) {
              if (blockType === BLOCK_TYPES.WATER && neighbor === BLOCK_TYPES.WATER) {
                drawFace = false;
              } else if (blockType === BLOCK_TYPES.GLASS && neighbor === BLOCK_TYPES.GLASS) {
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
              // Atlas is 4x4 tiles, so each tile is 0.25 x 0.25
              const atlasIndex = BLOCK_FACES[blockType]?.[face.uvFace as 'top' | 'bottom' | 'side'] ?? 3; // Default to stone if undefined
              
              const tx = atlasIndex % 4;
              const ty = 3 - Math.floor(atlasIndex / 4); // Invert Y for WebGL texture coordinate space
              
              const uMin = tx * 0.25;
              const uMax = (tx + 1) * 0.25;
              const vMin = ty * 0.25;
              const vMax = (ty + 1) * 0.25;

              // Map face corners to UV coordinates
              // corners sequence matches: v0, v1, v2, v3
              // UV coordinates for the face corners
              const uv0 = [uMin, vMin];
              const uv1 = [uMin, vMax];
              const uv2 = [uMax, vMax];
              const uv3 = [uMax, vMin];

              data.uvs.push(
                ...uv0, ...uv1, ...uv2, // Triangle 1
                ...uv0, ...uv2, ...uv3  // Triangle 2
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
    this.group.add(solidMesh);
    this.group.add(transMesh);

    // Save references to meshes
    this.chunkMeshes.set(key, { solid: solidMesh, transparent: transMesh });
  }

  // Load an area around a central chunk (generate if not existing, create meshes)
  public loadArea(centerX: number, centerZ: number, radius: number) {
    const ccx = Math.floor(centerX / CHUNK_SIZE_X);
    const ccz = Math.floor(centerZ / CHUNK_SIZE_Z);

    const activeKeys = new Set<string>();

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        const key = `${cx},${cz}`;
        activeKeys.add(key);

        if (!this.chunks.has(key)) {
          // Generate data first
          this.generateChunkData(cx, cz);
        }
      }
    }

    // Build meshes for those that need it
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        const key = `${cx},${cz}`;
        if (!this.chunkMeshes.has(key)) {
          this.updateChunkMesh(cx, cz);
        }
      }
    }

    // Unload chunks that are too far away
    for (const [key, meshes] of this.chunkMeshes.entries()) {
      if (!activeKeys.has(key)) {
        this.group.remove(meshes.solid);
        this.group.remove(meshes.transparent);
        meshes.solid.geometry.dispose();
        meshes.transparent.geometry.dispose();
        this.chunkMeshes.delete(key);
        // Note: we keep the chunk voxel data in this.chunks so it doesn't get lost,
        // we just unload it from the 3D GPU memory (Three.js group).
      }
    }
  }

  // Clean up WebGL resources
  public dispose() {
    for (const meshes of this.chunkMeshes.values()) {
      meshes.solid.geometry.dispose();
      meshes.transparent.geometry.dispose();
    }
    this.materials.solid.dispose();
    this.materials.transparent.dispose();
    this.textureAtlas.dispose();
  }

  // Serialize world to JSON (only saving modified blocks to keep save size small)
  public saveWorld(): string {
    // We can compare against procedurally generated blocks to only save modifications
    // For simplicity, let's just save the loaded chunks list or a diff map
    // Let's implement a simple chunk save
    const serializedChunks: Record<string, string> = {};
    for (const [key, bytes] of this.chunks.entries()) {
      // Compress Uint8Array to string representation
      serializedChunks[key] = Array.from(bytes).join(',');
    }
    return JSON.stringify({
      seed: this.seed,
      chunks: serializedChunks
    });
  }

  // Load world from JSON
  public loadWorld(saveStr: string) {
    try {
      const saved = JSON.parse(saveStr);
      if (saved.seed) {
        this.seed = saved.seed;
        this.noise.seed(saved.seed);
      }
      if (saved.chunks) {
        // Clear current meshes
        for (const meshes of this.chunkMeshes.values()) {
          this.group.remove(meshes.solid);
          this.group.remove(meshes.transparent);
          meshes.solid.geometry.dispose();
          meshes.transparent.geometry.dispose();
        }
        this.chunkMeshes.clear();
        this.chunks.clear();

        // Restore chunk data
        for (const [key, csv] of Object.entries(saved.chunks)) {
          const numbers = (csv as string).split(',').map(Number);
          this.chunks.set(key, new Uint8Array(numbers));
        }
      }
    } catch (e) {
      console.error('Failed to load world', e);
    }
  }
}
