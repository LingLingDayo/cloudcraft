/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { ImprovedNoise } from './Noise';
import { BLOCK_TYPES, BLOCK_FACES, getBlockProperties, type BlockType } from './BlockConfig';
import { generateTextureAtlas } from './TextureAtlas';
import { BlockRegistry } from './block/BlockRegistry';
import { BlockEntityManager } from './block/BlockEntityManager';

export { BLOCK_TYPES, getBlockProperties };

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 64;

export class World {
  public game: any;
  public blockEntities: BlockEntityManager;
  private fallingBlocks: Map<string, { x: number; y: number; z: number; blockId: number; timer: number }>;
  private chunks: Map<string, Uint8Array>;
  private noise: ImprovedNoise;
  private seed: string;
  private textureAtlas: THREE.Texture;
  public group: THREE.Group;
  private chunkMeshes: Map<string, { solid: THREE.Mesh; transparent: THREE.Mesh }>;
  public materials: { solid: THREE.Material; transparent: THREE.Material };

  constructor(seed = 'minicraft', game?: any) {
    this.seed = seed;
    this.game = game;
    this.blockEntities = new BlockEntityManager();
    this.fallingBlocks = new Map();
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

    const oldBlock = BlockRegistry.get(oldType);
    oldBlock.onDestroyed(this, x, y, z);
    this.blockEntities.removeEntity(x, y, z);

    chunk[index] = type;
    this.chunks.set(key, chunk);

    const newBlock = BlockRegistry.get(type);
    if (newBlock.hasBlockEntity()) {
      const entityType = type === BLOCK_TYPES.CHEST ? 'chest' : 'lever';
      this.blockEntities.createEntity(entityType, x, y, z);
    }
    newBlock.onPlaced(this, x, y, z);
    this.notifyNeighborsOfStateChange(x, y, z);

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
    const chunkRandom = this.pseudoRandom2D(cx, cz);
    if (chunkRandom < 0.25) { // 25% chance to have trees in a chunk
      const numTrees = Math.floor(chunkRandom * 12) % 3 + 1; // 1 to 3 trees
      for (let t = 0; t < numTrees; t++) {
        // Tree position using distinct seeds
        const tx = 2 + Math.floor(this.pseudoRandom2D(cx * 10 + t, cz * 10 + t) * (CHUNK_SIZE_X - 4));
        const tz = 2 + Math.floor(this.pseudoRandom2D(cx * 20 + t, cz * 20 + t) * (CHUNK_SIZE_Z - 4));
        // Find surface height
        let ty = CHUNK_SIZE_Y - 2;
        while (ty > 0 && chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z] === BLOCK_TYPES.AIR) {
          ty--;
        }

        const blockType = chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z];
        if (blockType === BLOCK_TYPES.GRASS && ty > 22) {
          // Determine tree type and size using a seeded random
          const treeTypeVal = this.pseudoRandom2D(cx * 30 + t, cz * 30 + t);
          const heightRand = this.pseudoRandom2D(cx * 40 + t, cz * 40 + t);
          
          let treeType: 'oak' | 'birch' | 'spruce';
          let trunkBlock: BlockType;
          let leafBlock: BlockType;
          let treeHeight: number;

          if (treeTypeVal < 0.4) {
            // Oak tree (40% probability)
            treeType = 'oak';
            trunkBlock = BLOCK_TYPES.WOOD;
            leafBlock = BLOCK_TYPES.LEAF;
            treeHeight = 4 + Math.floor(heightRand * 2);
          } else if (treeTypeVal < 0.75) {
            // Birch tree (35% probability)
            treeType = 'birch';
            trunkBlock = BLOCK_TYPES.BIRCH_WOOD;
            leafBlock = BLOCK_TYPES.BIRCH_LEAVES;
            treeHeight = 5 + Math.floor(heightRand * 3); // Height: 5 to 7
          } else {
            // Spruce tree (25% probability)
            treeType = 'spruce';
            trunkBlock = BLOCK_TYPES.SPRUCE_WOOD;
            leafBlock = BLOCK_TYPES.SPRUCE_LEAVES;
            treeHeight = 6 + Math.floor(heightRand * 3); // Height: 6 to 8
          }

          this.growTree(chunk, tx, ty, tz, trunkBlock, leafBlock, treeHeight, treeType);
        }
      }
    }

    return chunk;
  }

  private pseudoRandom2D(x: number, y: number): number {
    const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return a - Math.floor(a);
  }

  private growTree(
    chunk: Uint8Array,
    tx: number,
    ty: number,
    tz: number,
    trunkBlock: number,
    leafBlock: number,
    height: number,
    style: 'oak' | 'birch' | 'spruce'
  ): void {
    // Change grass below trunk to dirt
    chunk[tx + tz * CHUNK_SIZE_X + ty * CHUNK_SIZE_X * CHUNK_SIZE_Z] = BLOCK_TYPES.DIRT;

    // Grow trunk
    for (let h = 1; h <= height; h++) {
      const wly = ty + h;
      if (wly < CHUNK_SIZE_Y) {
        const trunkIdx = tx + tz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
        chunk[trunkIdx] = trunkBlock;
      }
    }

    // Grow canopy (leaves)
    const leafCenterY = ty + height;

    if (style === 'oak' || style === 'birch') {
      // Round canopy style
      const startY = style === 'birch' ? -3 : -2;
      for (let ly = startY; ly <= 1; ly++) {
        const radius = ly === 1 ? 1 : 2;
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            // Avoid placing leaves directly where trunk is
            if (lx === 0 && lz === 0 && ly <= 0) continue;
            
            // For birch, round the corners at the bottom layers to make it look nicer
            if (style === 'birch' && ly === startY && Math.abs(lx) === radius && Math.abs(lz) === radius) {
              continue;
            }

            const wlx = tx + lx;
            const wlz = tz + lz;
            const wly = leafCenterY + ly;

            // Random variation: slightly skip some outer leaves to make the shape irregular
            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              const leafRand = this.pseudoRandom2D(wlx * 17 + tx, wlz * 23 + tz + wly);
              if (leafRand < 0.20) {
                continue;
              }
            }

            if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < CHUNK_SIZE_Y) {
              const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              if (chunk[leafIdx] === BLOCK_TYPES.AIR) {
                chunk[leafIdx] = leafBlock;
              }
            }
          }
        }
      }
    } else if (style === 'spruce') {
      // Conical/layered canopy style for Spruce
      for (let ly = -4; ly <= 1; ly++) {
        let radius = 1;
        if (ly === 1) radius = 0;
        else if (ly === 0) radius = 1;
        else if (ly === -1) radius = 2;
        else if (ly === -2) radius = 1;
        else if (ly === -3) radius = 2;
        else if (ly === -4) radius = 2;

        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (lx === 0 && lz === 0 && ly <= 0) continue;
            
            // Round the 5x5 layers by clipping the corners
            if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
              continue;
            }

            const wlx = tx + lx;
            const wlz = tz + lz;
            const wly = leafCenterY + ly;

            // Random variation: slightly skip some outer leaves to make the shape irregular
            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              const leafRand = this.pseudoRandom2D(wlx * 17 + tx, wlz * 23 + tz + wly);
              if (leafRand < 0.20) {
                continue;
              }
            }

            if (wlx >= 0 && wlx < CHUNK_SIZE_X && wlz >= 0 && wlz < CHUNK_SIZE_Z && wly >= 0 && wly < CHUNK_SIZE_Y) {
              const leafIdx = wlx + wlz * CHUNK_SIZE_X + wly * CHUNK_SIZE_X * CHUNK_SIZE_Z;
              if (chunk[leafIdx] === BLOCK_TYPES.AIR) {
                chunk[leafIdx] = leafBlock;
              }
            }
          }
        }
      }
    }
  }

  // Check if a block is transparent (allows face rendering behind it)
  public isTransparent(blockType: number): boolean {
    return getBlockProperties(blockType).isTransparent;
  }

  // Update or create chunk meshes
  public updateChunkMesh(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const chunk = this.chunks.get(key);
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
            const nx = wx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = wz + face.dir[2];

            const neighbor = this.getBlock(nx, ny, nz);
            
            // Draw face if:
            // 1. Neighbor is air/transparent
            // 2. OR neighbor is the same transparent block (stops internal rendering of the same transparent type)
            let drawFace = false;
            if (this.isTransparent(neighbor)) {
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
              // Atlas is 4x4 tiles, so each tile is 0.25 x 0.25
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

              const atlasIndex = BLOCK_FACES[blockType]?.[uvFace] ?? 3; // Default to stone if undefined
              
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

  // Compress Uint8Array block data using Run-Length Encoding (RLE) to keep save size minimal
  private compressRLE(data: Uint8Array): string {
    const parts: string[] = [];
    if (data.length === 0) return '';
    let count = 1;
    let current = data[0];
    for (let i = 1; i < data.length; i++) {
      if (data[i] === current) {
        count++;
      } else {
        parts.push(`${current}_${count}`);
        current = data[i];
        count = 1;
      }
    }
    parts.push(`${current}_${count}`);
    return parts.join(',');
  }

  // Decompress RLE compressed string back to Uint8Array of fixed length
  private decompressRLE(rleStr: string, length: number): Uint8Array {
    const result = new Uint8Array(length);
    const parts = rleStr.split(',');
    let idx = 0;
    for (const part of parts) {
      if (!part) continue;
      const separatorIdx = part.indexOf('_');
      if (separatorIdx === -1) {
        // Fallback for single numbers in case of corruption
        const val = Number(part);
        if (idx < length) {
          result[idx++] = val;
        }
        continue;
      }
      const val = Number(part.substring(0, separatorIdx));
      const count = Number(part.substring(separatorIdx + 1));
      for (let i = 0; i < count; i++) {
        if (idx < length) {
          result[idx++] = val;
        }
      }
    }
    return result;
  }

  // Serialize world to JSON (using RLE compression to fit within browser storage quota)
  public saveWorld(): string {
    const serializedChunks: Record<string, string> = {};
    for (const [key, bytes] of this.chunks.entries()) {
      serializedChunks[key] = this.compressRLE(bytes);
    }
    return JSON.stringify({
      seed: this.seed,
      chunks: serializedChunks,
      entities: this.blockEntities.serialize()
    });
  }

  // Load world from JSON (supports both modern RLE compressed and legacy flat CSV formatted saves)
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
        const expectedLength = CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_SIZE_Y;
        for (const [key, csv] of Object.entries(saved.chunks)) {
          const csvStr = csv as string;
          if (csvStr.includes('_')) {
            // Modern compressed format
            this.chunks.set(key, this.decompressRLE(csvStr, expectedLength));
          } else {
            // Legacy flat CSV format
            const numbers = csvStr.split(',').map(Number);
            this.chunks.set(key, new Uint8Array(numbers));
          }
        }
      }
      if (saved.entities) {
        this.blockEntities.deserialize(saved.entities);
      } else {
        this.blockEntities.clear();
      }
    } catch (e) {
      console.error('Failed to load world', e);
    }
  }

  public addFallingBlock(x: number, y: number, z: number) {
    const blockId = this.getBlock(x, y, z);
    if (blockId === BLOCK_TYPES.AIR) return;
    const key = `${x},${y},${z}`;
    if (!this.fallingBlocks.has(key)) {
      this.fallingBlocks.set(key, { x, y, z, blockId, timer: 0.1 });
    }
  }

  public update(dt: number) {
    if (this.fallingBlocks.size === 0) return;
    const fbs = Array.from(this.fallingBlocks.entries());
    for (const [key, fb] of fbs) {
      fb.timer -= dt;
      if (fb.timer <= 0) {
        this.fallingBlocks.delete(key);
        const currentType = this.getBlock(fb.x, fb.y, fb.z);
        if (currentType === fb.blockId) {
          const belowY = fb.y - 1;
          const belowType = this.getBlock(fb.x, belowY, fb.z);
          if (belowType === BLOCK_TYPES.AIR || belowType === BLOCK_TYPES.WATER) {
            // Lower sand block by 1 voxel
            this.setBlock(fb.x, fb.y, fb.z, BLOCK_TYPES.AIR);
            this.setBlock(fb.x, belowY, fb.z, fb.blockId);
            // Recursively trigger next fall check
            this.addFallingBlock(fb.x, belowY, fb.z);
          }
        }
      }
    }
  }

  public notifyNeighborsOfStateChange(x: number, y: number, z: number) {
    const neighbors = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];
    for (const [dx, dy, dz] of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      const neighborId = this.getBlock(nx, ny, nz);
      const neighborBlock = BlockRegistry.get(neighborId);
      neighborBlock.onNeighborChanged(this, nx, ny, nz, x, y, z);
    }
  }

}
