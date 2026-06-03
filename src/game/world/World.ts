/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { BLOCK_TYPES, getBlockProperties } from './BlockConfig';
import { BlockRegistry } from './block/BlockRegistry';
import { BlockEntityManager } from './block/BlockEntityManager';
import { WorldGenerator } from './WorldGenerator';
import { ChunkRenderer } from './ChunkRenderer';
import { WorldSerializer } from './WorldSerializer';

export { BLOCK_TYPES, getBlockProperties };

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 64;

export class World {
  public game: any;
  public blockEntities: BlockEntityManager;
  private fallingBlocks: Map<string, { x: number; y: number; z: number; blockId: number; timer: number }>;
  public chunks: Map<string, Uint8Array>;
  public group: THREE.Group;
  
  private seed: string;
  private generator: WorldGenerator;
  private renderer: ChunkRenderer;

  constructor(seed = 'minicraft', game?: any) {
    this.seed = seed;
    this.game = game;
    this.blockEntities = new BlockEntityManager();
    this.fallingBlocks = new Map();
    this.chunks = new Map();
    this.group = new THREE.Group();
    
    this.generator = new WorldGenerator(seed);
    this.renderer = new ChunkRenderer(this);
  }

  public getSeed(): string {
    return this.seed;
  }

  public setSeed(seed: string): void {
    this.seed = seed;
    this.generator.setSeed(seed);
  }

  public getRenderer(): ChunkRenderer {
    return this.renderer;
  }

  public get materials(): { solid: THREE.Material; transparent: THREE.Material } {
    return this.renderer.materials;
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
      chunk = this.generator.generateChunkData(cx, cz);
      this.chunks.set(key, chunk);
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
      chunk = this.generator.generateChunkData(cx, cz);
      this.chunks.set(key, chunk);
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

  public updateChunkMesh(cx: number, cz: number) {
    this.renderer.updateChunkMesh(cx, cz, this.chunks);
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
          const chunk = this.generator.generateChunkData(cx, cz);
          this.chunks.set(key, chunk);
        }
      }
    }

    // Build meshes for those that need it
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        const key = `${cx},${cz}`;
        if (!this.renderer.hasChunkMesh(key)) {
          this.updateChunkMesh(cx, cz);
        }
      }
    }

    // Unload chunks that are too far away
    const chunkMeshes = this.renderer.getChunkMeshes();
    for (const key of chunkMeshes.keys()) {
      if (!activeKeys.has(key)) {
        this.renderer.removeChunkMesh(key);
      }
    }
  }

  // Clean up WebGL resources
  public dispose() {
    this.renderer.dispose();
  }

  // Serialize world to JSON (using RLE compression to fit within browser storage quota)
  public saveWorld(): string {
    return WorldSerializer.saveWorld(this);
  }

  // Load world from JSON (supports both modern RLE compressed and legacy flat CSV formatted saves)
  public loadWorld(saveStr: string) {
    WorldSerializer.loadWorld(this, saveStr);
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

  public isTransparent(blockType: number): boolean {
    return getBlockProperties(blockType).isTransparent;
  }

  public growTree(
    chunk: Uint8Array,
    tx: number,
    ty: number,
    tz: number,
    trunkBlock: number,
    leafBlock: number,
    height: number,
    style: 'oak' | 'birch' | 'spruce' | 'jungle'
  ): void {
    this.generator.growTree(chunk, tx, ty, tz, trunkBlock, leafBlock, height, style);
  }
}
