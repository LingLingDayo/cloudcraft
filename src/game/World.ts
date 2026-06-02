import * as THREE from 'three';
import { ImprovedNoise } from './Noise';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 64;

export const BLOCK_TYPES = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAF: 5,
  BRICK: 6,
  GLASS: 7,
  WATER: 8,
  SAND: 9,
  COAL: 10,
  IRON: 11,
  DIAMOND: 12,
};

// Define block colors/textures mapping in the atlas
// Atlas is 4x4 grid of 16x16 tiles
// Tile index:
// 0: Grass Top, 1: Grass Side, 2: Dirt, 3: Stone
// 4: Wood Side, 5: Wood Top, 6: Leaf, 7: Brick
// 8: Glass, 9: Water, 10: Sand, 11: Coal
// 12: Iron, 13: Diamond
const BLOCK_FACES: Record<number, Record<string, number>> = {
  [BLOCK_TYPES.GRASS]: { top: 0, bottom: 2, side: 1 },
  [BLOCK_TYPES.DIRT]: { top: 2, bottom: 2, side: 2 },
  [BLOCK_TYPES.STONE]: { top: 3, bottom: 3, side: 3 },
  [BLOCK_TYPES.WOOD]: { top: 5, bottom: 5, side: 4 },
  [BLOCK_TYPES.LEAF]: { top: 6, bottom: 6, side: 6 },
  [BLOCK_TYPES.BRICK]: { top: 7, bottom: 7, side: 7 },
  [BLOCK_TYPES.GLASS]: { top: 8, bottom: 8, side: 8 },
  [BLOCK_TYPES.WATER]: { top: 9, bottom: 9, side: 9 },
  [BLOCK_TYPES.SAND]: { top: 10, bottom: 10, side: 10 },
  [BLOCK_TYPES.COAL]: { top: 11, bottom: 11, side: 11 },
  [BLOCK_TYPES.IRON]: { top: 12, bottom: 12, side: 12 },
  [BLOCK_TYPES.DIAMOND]: { top: 13, bottom: 13, side: 13 },
};

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
    this.textureAtlas = this.generateTextureAtlas();
    
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

  // Generate dynamic pixel textures on a canvas
  private generateTextureAtlas(): THREE.Texture {
    const tileSize = 16;
    const atlasCols = 4;
    const canvas = document.createElement('canvas');
    canvas.width = tileSize * atlasCols;
    canvas.height = tileSize * atlasCols;
    const ctx = canvas.getContext('2d')!;

    // Helper to fill with noise
    const fillNoise = (x: number, y: number, r: number, g: number, b: number, noiseIntensity: number) => {
      for (let py = 0; py < tileSize; py++) {
        for (let px = 0; px < tileSize; px++) {
          const n = (Math.random() - 0.5) * noiseIntensity;
          ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, r + n))}, ${Math.min(255, Math.max(0, g + n))}, ${Math.min(255, Math.max(0, b + n))})`;
          ctx.fillRect(x + px, y + py, 1, 1);
        }
      }
    };

    // 0: Grass Top
    fillNoise(0, 0, 90, 160, 50, 25);
    // Add pixelated blades
    ctx.fillStyle = 'rgb(70, 140, 40)';
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(Math.floor(Math.random() * tileSize), Math.floor(Math.random() * tileSize), 1, 1);
    }

    // 1: Grass Side
    fillNoise(tileSize, 0, 130, 90, 60, 20); // Dirt base
    ctx.fillStyle = 'rgb(90, 160, 50)'; // Grass top edge
    ctx.fillRect(tileSize, 0, tileSize, 4);
    // Draw hanging grass bits
    for (let px = 0; px < tileSize; px++) {
      const h = 4 + Math.floor(Math.sin(px * 1.5) * 2 + Math.random() * 2);
      ctx.fillRect(tileSize + px, 0, 1, h);
    }

    // 2: Dirt
    fillNoise(tileSize * 2, 0, 130, 90, 60, 20);
    ctx.fillStyle = 'rgb(100, 70, 45)';
    for (let i = 0; i < 15; i++) {
      ctx.fillRect(tileSize * 2 + Math.floor(Math.random() * tileSize), Math.floor(Math.random() * tileSize), 2, 1);
    }

    // 3: Stone
    fillNoise(tileSize * 3, 0, 120, 120, 120, 20);
    ctx.fillStyle = 'rgb(90, 90, 90)';
    for (let i = 0; i < 15; i++) {
      ctx.fillRect(tileSize * 3 + Math.floor(Math.random() * tileSize), Math.floor(Math.random() * tileSize), 2, 2);
    }

    // 4: Wood Side
    fillNoise(0, tileSize, 120, 85, 45, 15);
    ctx.fillStyle = 'rgb(80, 55, 30)'; // Bark lines
    for (let py = 0; py < tileSize; py++) {
      ctx.fillRect(2 + Math.floor(Math.sin(py * 0.5) * 1), tileSize + py, 2, 1);
      ctx.fillRect(10 + Math.floor(Math.sin(py * 0.5 + 2) * 1), tileSize + py, 2, 1);
    }

    // 5: Wood Top (concentric rings)
    fillNoise(tileSize, tileSize, 185, 150, 100, 10);
    ctx.strokeStyle = 'rgb(120, 85, 45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tileSize + 2.5, tileSize + 2.5, tileSize - 5, tileSize - 5);
    ctx.strokeRect(tileSize + 5.5, tileSize + 5.5, tileSize - 11, tileSize - 11);

    // 6: Leaf
    fillNoise(tileSize * 2, tileSize, 45, 120, 35, 30);
    ctx.fillStyle = 'rgb(25, 80, 20)';
    for (let i = 0; i < 12; i++) {
      ctx.fillRect(tileSize * 2 + Math.floor(Math.random() * tileSize), tileSize + Math.floor(Math.random() * tileSize), 2, 2);
    }

    // 7: Brick
    fillNoise(tileSize * 3, tileSize, 160, 60, 45, 15);
    ctx.fillStyle = 'rgb(180, 180, 180)'; // Mortar
    ctx.fillRect(tileSize * 3, tileSize + 4, tileSize, 1);
    ctx.fillRect(tileSize * 3, tileSize + 9, tileSize, 1);
    ctx.fillRect(tileSize * 3, tileSize + 14, tileSize, 1);
    ctx.fillRect(tileSize * 3 + 4, tileSize, 1, 4);
    ctx.fillRect(tileSize * 3 + 12, tileSize, 1, 4);
    ctx.fillRect(tileSize * 3 + 8, tileSize + 5, 1, 4);
    ctx.fillRect(tileSize * 3 + 2, tileSize + 10, 1, 4);
    ctx.fillRect(tileSize * 3 + 10, tileSize + 10, 1, 4);

    // 8: Glass
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, tileSize * 2, tileSize, tileSize);
    ctx.strokeStyle = 'rgb(150, 230, 255)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, tileSize * 2 + 0.5, tileSize - 1, tileSize - 1);
    ctx.beginPath();
    ctx.moveTo(3, tileSize * 2 + 13);
    ctx.lineTo(13, tileSize * 2 + 3);
    ctx.stroke();

    // 9: Water
    fillNoise(tileSize, tileSize * 2, 40, 110, 220, 15);
    // Draw waves
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let py = 2; py < tileSize; py += 4) {
      for (let px = 0; px < tileSize; px++) {
        if ((px + py) % 4 === 0) {
          ctx.fillRect(tileSize + px, tileSize * 2 + py, 2, 1);
        }
      }
    }

    // 10: Sand
    fillNoise(tileSize * 2, tileSize * 2, 220, 205, 140, 15);
    ctx.fillStyle = 'rgb(195, 180, 115)';
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(tileSize * 2 + Math.floor(Math.random() * tileSize), tileSize * 2 + Math.floor(Math.random() * tileSize), 1, 1);
    }

    // 11: Coal Ore
    fillNoise(tileSize * 3, tileSize * 2, 120, 120, 120, 20); // Stone base
    ctx.fillStyle = 'rgb(40, 40, 40)'; // Coal spots
    ctx.fillRect(tileSize * 3 + 3, tileSize * 2 + 3, 2, 2);
    ctx.fillRect(tileSize * 3 + 8, tileSize * 2 + 10, 3, 2);
    ctx.fillRect(tileSize * 3 + 12, tileSize * 2 + 4, 2, 1);
    ctx.fillRect(tileSize * 3 + 2, tileSize * 2 + 11, 2, 2);

    // 12: Iron Ore
    fillNoise(0, tileSize * 3, 120, 120, 120, 20); // Stone base
    ctx.fillStyle = 'rgb(190, 130, 90)'; // Iron spots
    ctx.fillRect(3, tileSize * 3 + 4, 3, 2);
    ctx.fillRect(9, tileSize * 3 + 9, 2, 2);
    ctx.fillRect(11, tileSize * 3 + 3, 2, 2);
    ctx.fillRect(2, tileSize * 3 + 12, 3, 1);

    // 13: Diamond Ore
    fillNoise(tileSize, tileSize * 3, 120, 120, 120, 20); // Stone base
    ctx.fillStyle = 'rgb(90, 220, 240)'; // Diamond spots
    ctx.fillRect(tileSize + 4, tileSize * 3 + 4, 2, 2);
    ctx.fillRect(tileSize + 10, tileSize * 3 + 10, 2, 2);
    ctx.fillRect(tileSize + 2, tileSize * 3 + 11, 2, 1);
    ctx.fillRect(tileSize + 11, tileSize * 3 + 3, 2, 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
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
              const atlasIndex = BLOCK_FACES[blockType]?.[face.uvFace] ?? 3; // Default to stone if undefined
              
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
