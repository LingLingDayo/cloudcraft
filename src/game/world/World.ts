/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { BLOCK_TYPES, getBlockProperties } from './BlockConfig';
import { BlockRegistry } from './block/BlockRegistry';
import { BlockEntityManager } from './block/BlockEntityManager';
import { WorldGenerator } from './WorldGenerator';
import { ChunkRenderer } from './ChunkRenderer';
import { WorldSerializer } from './WorldSerializer';
import { TreeStyle } from './biome/Biome';
import { sound } from '@game/systems/Sound';
import type { BlockType } from '@type';
import { ItemType } from '@type';
import { ItemRegistry } from '@game/item/ItemRegistry';
import { useGameStore } from '@store/useGameStore';

export { BLOCK_TYPES, getBlockProperties };

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 16;
export const WORLD_HEIGHT = 512;

export class World {
  public game: any;
  public blockEntities: BlockEntityManager;
  private fallingBlocks: Map<string, { x: number; y: number; z: number; blockId: number; timer: number }>;
  private decayingLeaves: Map<string, { x: number; y: number; z: number; timer: number }>;
  private growingSaplings: Map<string, { x: number; y: number; z: number; timer: number; saplingType: number }>;
  public chunks: Map<string, Uint8Array>;
  public group: THREE.Group;
  
  // Track modifications: chunkKey -> relativePosKey -> blockType
  public modifiedBlocks: Map<string, Map<string, number>>;
  // Track original blocks for reverting: chunkKey -> relativePosKey -> blockType
  private originalBlocks: Map<string, Map<string, number>>;

  private seed: string;
  private generator: WorldGenerator;
  private renderer: ChunkRenderer;
  private pendingGenerationQueue: string[] = [];
  private pendingMeshQueue: string[] = [];

  constructor(seed = 'minicraft', game?: any) {
    this.seed = seed;
    this.game = game;
    this.blockEntities = new BlockEntityManager();
    this.fallingBlocks = new Map();
    this.decayingLeaves = new Map();
    this.growingSaplings = new Map();
    this.chunks = new Map();
    this.modifiedBlocks = new Map();
    this.originalBlocks = new Map();
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

  public get materials(): { solid: THREE.Material; transparent: THREE.Material; cutout: THREE.Material } {
    return this.renderer.materials;
  }

  // Get chunk coordinates from world coordinates
  public getChunkKey(x: number, y: number, z: number): string {
    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cy = Math.floor(y / CHUNK_SIZE_Y);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    return `${cx},${cy},${cz}`;
  }

  // Get block at global x, y, z
  public getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_HEIGHT) return BLOCK_TYPES.AIR;

    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cy = Math.floor(y / CHUNK_SIZE_Y);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    const key = `${cx},${cy},${cz}`;

    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generator.generateChunkData(cx, cy, cz);
      this.applyChunkModifications(key, chunk);
      this.chunks.set(key, chunk);
    }

    const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const ly = ((y % CHUNK_SIZE_Y) + CHUNK_SIZE_Y) % CHUNK_SIZE_Y;
    const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    const index = lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z;

    return chunk[index];
  }

  // Set block at global x, y, z
  public setBlock(x: number, y: number, z: number, type: number) {
    if (y < 0 || y >= WORLD_HEIGHT) return;

    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cy = Math.floor(y / CHUNK_SIZE_Y);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    const key = `${cx},${cy},${cz}`;

    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generator.generateChunkData(cx, cy, cz);
      this.applyChunkModifications(key, chunk);
      this.chunks.set(key, chunk);
    }

    const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const ly = ((y % CHUNK_SIZE_Y) + CHUNK_SIZE_Y) % CHUNK_SIZE_Y;
    const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    const index = lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z;

    const oldType = chunk[index];
    if (oldType === type) return;

    // Track modification
    const posKey = `${lx},${ly},${lz}`;
    let chunkOriginal = this.originalBlocks.get(key);
    if (!chunkOriginal) {
      chunkOriginal = new Map();
      this.originalBlocks.set(key, chunkOriginal);
    }

    if (!chunkOriginal.has(posKey)) {
      const chunkModified = this.modifiedBlocks.get(key);
      if (chunkModified && chunkModified.has(posKey)) {
        const originalChunk = this.generator.generateChunkData(cx, cy, cz);
        const originalType = originalChunk[index];
        chunkOriginal.set(posKey, originalType);
      } else {
        chunkOriginal.set(posKey, oldType);
      }
    }

    const originalType = chunkOriginal.get(posKey)!;

    let chunkModified = this.modifiedBlocks.get(key);
    if (!chunkModified) {
      chunkModified = new Map();
      this.modifiedBlocks.set(key, chunkModified);
    }

    if (type === originalType) {
      chunkModified.delete(posKey);
      chunkOriginal.delete(posKey);
    } else {
      chunkModified.set(posKey, type);
    }

    if (chunkModified.size === 0) {
      this.modifiedBlocks.delete(key);
    }
    if (chunkOriginal.size === 0) {
      this.originalBlocks.delete(key);
    }

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
    this.updateChunkMesh(cx, cy, cz);

    // If block is on the edge of the chunk, update neighbor chunks too
    if (lx === 0) this.updateChunkMesh(cx - 1, cy, cz);
    if (lx === CHUNK_SIZE_X - 1) this.updateChunkMesh(cx + 1, cy, cz);
    if (ly === 0) this.updateChunkMesh(cx, cy - 1, cz);
    if (ly === CHUNK_SIZE_Y - 1) this.updateChunkMesh(cx, cy + 1, cz);
    if (lz === 0) this.updateChunkMesh(cx, cy, cz - 1);
    if (lz === CHUNK_SIZE_Z - 1) this.updateChunkMesh(cx, cy, cz + 1);
  }

  public updateChunkMesh(cx: number, cy: number, cz: number) {
    this.renderer.updateChunkMesh(cx, cy, cz, this.chunks);
    
    // Update chunk loading progress in store
    const store = useGameStore.getState();
    if (store.isWorldLoading) {
      const key = `${cx},${cy},${cz}`;
      if (store.chunkLoadingStates[key] === false) {
        store.setChunkLoadingState(key, true);
      }
    }
  }

  // Load an area around a central chunk (generate if not existing, create meshes)
  public loadArea(centerX: number, centerY: number, centerZ: number, radius: number, sync = false) {
    const shouldSync = sync || !this.game;
    const ccx = Math.floor(centerX / CHUNK_SIZE_X);
    const ccy = Math.floor(centerY / CHUNK_SIZE_Y);
    const ccz = Math.floor(centerZ / CHUNK_SIZE_Z);

    const activeKeys = new Set<string>();
    const neededGeneration: string[] = [];
    const verticalRadius = 6; // Load 6 chunks up and down (covers 192 blocks)

    // Initialize loading progress for this area if we are in world loading screen and asynchronous
    if (!shouldSync) {
      const store = useGameStore.getState();
      if (store.isWorldLoading) {
        const keys: string[] = [];
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -verticalRadius; dy <= verticalRadius; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
              const cx = ccx + dx;
              const cy = ccy + dy;
              const cz = ccz + dz;
              if (cy >= 0 && cy < WORLD_HEIGHT / CHUNK_SIZE_Y) {
                keys.push(`${cx},${cy},${cz}`);
              }
            }
          }
        }
        // Only initialize if the keys list is different
        const currentKeys = Object.keys(store.chunkLoadingStates);
        const keysMatch = keys.length === currentKeys.length && keys.every(k => currentKeys.includes(k));
        if (!keysMatch) {
          store.setWorldLoadingStage('chunks');
          store.initChunkLoading(keys);
          // Mark already loaded chunks as true immediately
          keys.forEach(key => {
            if (this.renderer.hasChunkMesh(key)) {
              store.setChunkLoadingState(key, true);
            }
          });
        }
      }
    }

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -verticalRadius; dy <= verticalRadius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const cx = ccx + dx;
          const cy = ccy + dy;
          const cz = ccz + dz;
          if (cy < 0 || cy >= WORLD_HEIGHT / CHUNK_SIZE_Y) continue;

          const key = `${cx},${cy},${cz}`;
          activeKeys.add(key);

          if (shouldSync) {
            if (!this.chunks.has(key)) {
              const chunk = this.generator.generateChunkData(cx, cy, cz);
              this.applyChunkModifications(key, chunk);
              this.chunks.set(key, chunk);
            }
          } else {
            if (!this.chunks.has(key)) {
              neededGeneration.push(key);
            }
          }
        }
      }
    }

    if (shouldSync) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -verticalRadius; dy <= verticalRadius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const cx = ccx + dx;
            const cy = ccy + dy;
            const cz = ccz + dz;
            if (cy < 0 || cy >= WORLD_HEIGHT / CHUNK_SIZE_Y) continue;

            const key = `${cx},${cy},${cz}`;
            if (!this.renderer.hasChunkMesh(key)) {
              this.updateChunkMesh(cx, cy, cz);
            }
          }
        }
      }
      this.pendingGenerationQueue = [];
      this.pendingMeshQueue = [];
    } else {
      const neededMesh: string[] = [];
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -verticalRadius; dy <= verticalRadius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const cx = ccx + dx;
            const cy = ccy + dy;
            const cz = ccz + dz;
            if (cy < 0 || cy >= WORLD_HEIGHT / CHUNK_SIZE_Y) continue;

            const key = `${cx},${cy},${cz}`;
            if (!this.renderer.hasChunkMesh(key) && this.chunks.has(key)) {
              neededMesh.push(key);
            }
          }
        }
      }

      // Sort both queues by distance to player (closer chunks loaded first)
      const getDistanceSq = (key: string) => {
        const [cx, cy, cz] = key.split(',').map(Number);
        const dcx = cx - ccx;
        const dcy = cy - ccy;
        const dcz = cz - ccz;
        return dcx * dcx + dcy * dcy + dcz * dcz;
      };

      neededGeneration.sort((a, b) => getDistanceSq(a) - getDistanceSq(b));
      neededMesh.sort((a, b) => getDistanceSq(a) - getDistanceSq(b));

      this.pendingGenerationQueue = neededGeneration;
      this.pendingMeshQueue = neededMesh;
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

  // Serialize world to JSON (only saves modified blocks to keep save size minimal)
  public saveWorld(): string {
    return WorldSerializer.saveWorld(this);
  }

  // Load world from JSON
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

  private processIncrementalLoading() {
    if (!this.game) return;

    const startTime = performance.now();
    const BUDGET_MS = 8; // Max time budget in ms per frame for loading chunks

    const playerX = this.game.player.position.x;
    const playerY = this.game.player.position.y;
    const playerZ = this.game.player.position.z;
    const ccx = Math.floor(playerX / CHUNK_SIZE_X);
    const ccy = Math.floor(playerY / CHUNK_SIZE_Y);
    const ccz = Math.floor(playerZ / CHUNK_SIZE_Z);

    const getDistanceSq = (key: string) => {
      const [cx, cy, cz] = key.split(',').map(Number);
      const dcx = cx - ccx;
      const dcy = cy - ccy;
      const dcz = cz - ccz;
      return dcx * dcx + dcy * dcy + dcz * dcz;
    };

    while (performance.now() - startTime < BUDGET_MS) {
      if (this.pendingMeshQueue.length > 0) {
        const key = this.pendingMeshQueue.shift();
        if (key) {
          const [cx, cy, cz] = key.split(',').map(Number);
          if (this.chunks.has(key)) {
            this.updateChunkMesh(cx, cy, cz);
          }
        }
      } else if (this.pendingGenerationQueue.length > 0) {
        const key = this.pendingGenerationQueue.shift();
        if (key) {
          const [cx, cy, cz] = key.split(',').map(Number);
          if (!this.chunks.has(key)) {
            const chunk = this.generator.generateChunkData(cx, cy, cz);
            this.applyChunkModifications(key, chunk);
            this.chunks.set(key, chunk);

            // Once generated, queue it for mesh creation and re-sort by proximity
            this.pendingMeshQueue.push(key);
            this.pendingMeshQueue.sort((a, b) => getDistanceSq(a) - getDistanceSq(b));
          }
        }
      } else {
        break; // No more items to load
      }
    }
  }

  public update(dt: number) {
    this.processIncrementalLoading();

    // 1. Update falling blocks
    if (this.fallingBlocks.size > 0) {
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

    // 2. Update leaf decay
    if (this.decayingLeaves.size > 0) {
      const leaves = Array.from(this.decayingLeaves.entries());
      for (const [key, dl] of leaves) {
        dl.timer -= dt;
        if (dl.timer <= 0) {
          this.decayingLeaves.delete(key);
          const currentType = this.getBlock(dl.x, dl.y, dl.z);
          const cleanType = currentType & 0x3F;
          const isLeaf = cleanType === BLOCK_TYPES.LEAF || 
                         cleanType === BLOCK_TYPES.BIRCH_LEAVES || 
                         cleanType === BLOCK_TYPES.SPRUCE_LEAVES || 
                         cleanType === BLOCK_TYPES.JUNGLE_LEAVES;
          if (isLeaf) {
            if (!this.isConnectedToWood(dl.x, dl.y, dl.z)) {
              this.setBlock(dl.x, dl.y, dl.z, BLOCK_TYPES.AIR);
              
              const blockInstance = BlockRegistry.get(currentType);
              const color = blockInstance.properties.colorHex ?? 0x2d7823;
              if (this.game && this.game.particles) {
                this.game.particles.spawn(
                  new THREE.Vector3(dl.x + 0.5, dl.y + 0.5, dl.z + 0.5),
                  color,
                  8
                );
              }
              
              sound.playBreak();

              if (Math.random() < 0.1) {
                let saplingType: BlockType = BLOCK_TYPES.OAK_SAPLING;
                if (cleanType === BLOCK_TYPES.BIRCH_LEAVES) saplingType = BLOCK_TYPES.BIRCH_SAPLING;
                else if (cleanType === BLOCK_TYPES.SPRUCE_LEAVES) saplingType = BLOCK_TYPES.SPRUCE_SAPLING;
                else if (cleanType === BLOCK_TYPES.JUNGLE_LEAVES) saplingType = BLOCK_TYPES.JUNGLE_SAPLING;

                if (this.game && this.game.droppedItems) {
                  const itemType = ItemRegistry.getItemTypeFromBlockType(saplingType);
                  if (itemType) {
                    this.game.droppedItems.spawnItem(
                      itemType,
                      new THREE.Vector3(dl.x + 0.5, dl.y + 0.5, dl.z + 0.5)
                    );
                  }
                }
              }

              // Oak leaves have a 5% chance of dropping an apple when decaying naturally
              if (cleanType === BLOCK_TYPES.LEAF && Math.random() < 0.05) {
                if (this.game && this.game.droppedItems) {
                  this.game.droppedItems.spawnItem(
                    ItemType.APPLE,
                    new THREE.Vector3(dl.x + 0.5, dl.y + 0.5, dl.z + 0.5)
                  );
                }
              }
            }
          }
        }
      }
    }

    // 3. Update sapling growth
    if (this.growingSaplings.size > 0) {
      const saplings = Array.from(this.growingSaplings.entries());
      for (const [key, gs] of saplings) {
        gs.timer -= dt;
        if (gs.timer <= 0) {
          this.growingSaplings.delete(key);
          const currentType = this.getBlock(gs.x, gs.y, gs.z);
          if ((currentType & 0x3F) === (gs.saplingType & 0x3F)) {
            this.setBlock(gs.x, gs.y, gs.z, BLOCK_TYPES.AIR);

            let woodBlock: BlockType = BLOCK_TYPES.WOOD;
            let leafBlock: BlockType = BLOCK_TYPES.LEAF;
            let style: TreeStyle = TreeStyle.OAK;

            if (gs.saplingType === BLOCK_TYPES.BIRCH_SAPLING) {
              woodBlock = BLOCK_TYPES.BIRCH_WOOD;
              leafBlock = BLOCK_TYPES.BIRCH_LEAVES;
              style = TreeStyle.BIRCH;
            } else if (gs.saplingType === BLOCK_TYPES.SPRUCE_SAPLING) {
              woodBlock = BLOCK_TYPES.SPRUCE_WOOD;
              leafBlock = BLOCK_TYPES.SPRUCE_LEAVES;
              style = TreeStyle.SPRUCE;
            } else if (gs.saplingType === BLOCK_TYPES.JUNGLE_SAPLING) {
              woodBlock = BLOCK_TYPES.JUNGLE_WOOD;
              leafBlock = BLOCK_TYPES.JUNGLE_LEAVES;
              style = TreeStyle.JUNGLE;
            }

            this.spawnTree(gs.x, gs.y, gs.z, woodBlock, leafBlock, style);
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
    style: TreeStyle
  ): void {
    this.generator.growTree(chunk, tx, ty, tz, trunkBlock, leafBlock, height, style);
  }

  public registerSapling(x: number, y: number, z: number, saplingType: number) {
    const key = `${x},${y},${z}`;
    // Sapling grows in 10 to 20 seconds
    const growTime = 10.0 + Math.random() * 10.0;
    this.growingSaplings.set(key, { x, y, z, timer: growTime, saplingType });
  }

  public unregisterSapling(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`;
    this.growingSaplings.delete(key);
  }

  public checkLeafDecay(x: number, y: number, z: number) {
    const blockId = this.getBlock(x, y, z) & 0x3F;
    const isLeafType = blockId === BLOCK_TYPES.LEAF || 
                       blockId === BLOCK_TYPES.BIRCH_LEAVES || 
                       blockId === BLOCK_TYPES.SPRUCE_LEAVES || 
                       blockId === BLOCK_TYPES.JUNGLE_LEAVES;
    if (!isLeafType) return;

    if (!this.isConnectedToWood(x, y, z)) {
      const key = `${x},${y},${z}`;
      if (!this.decayingLeaves.has(key)) {
        this.decayingLeaves.set(key, { x, y, z, timer: 1.0 + Math.random() * 3.0 });
      }
    } else {
      const key = `${x},${y},${z}`;
      if (this.decayingLeaves.has(key)) {
        this.decayingLeaves.delete(key);
      }
    }
  }

  public isConnectedToWood(startX: number, startY: number, startZ: number): boolean {
    const maxDistance = 4;
    const queue: { x: number; y: number; z: number; dist: number }[] = [];
    const visited = new Set<string>();

    queue.push({ x: startX, y: startY, z: startZ, dist: 0 });
    visited.add(`${startX},${startY},${startZ}`);

    const isWood = (id: number) => {
      const cleanId = id & 0x3F;
      return cleanId === BLOCK_TYPES.WOOD || 
             cleanId === BLOCK_TYPES.BIRCH_WOOD || 
             cleanId === BLOCK_TYPES.SPRUCE_WOOD || 
             cleanId === BLOCK_TYPES.JUNGLE_WOOD;
    };

    const isLeaf = (id: number) => {
      const cleanId = id & 0x3F;
      return cleanId === BLOCK_TYPES.LEAF || 
             cleanId === BLOCK_TYPES.BIRCH_LEAVES || 
             cleanId === BLOCK_TYPES.SPRUCE_LEAVES || 
             cleanId === BLOCK_TYPES.JUNGLE_LEAVES;
    };

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      const currentBlockId = this.getBlock(current.x, current.y, current.z);
      if (isWood(currentBlockId)) {
        return true;
      }

      if (current.dist < maxDistance) {
        const neighbors = [
          [1, 0, 0], [-1, 0, 0],
          [0, 1, 0], [0, -1, 0],
          [0, 0, 1], [0, 0, -1]
        ];

        for (const [dx, dy, dz] of neighbors) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          const nz = current.z + dz;
          const key = `${nx},${ny},${nz}`;

          if (!visited.has(key)) {
            visited.add(key);
            const neighborBlockId = this.getBlock(nx, ny, nz);
            if (isLeaf(neighborBlockId) || isWood(neighborBlockId)) {
              queue.push({ x: nx, y: ny, z: nz, dist: current.dist + 1 });
            }
          }
        }
      }
    }

    return false;
  }

  public spawnTree(
    x: number,
    y: number,
    z: number,
    trunkBlock: number,
    leafBlock: number,
    style: TreeStyle
  ): void {
    const height = 4 + Math.floor(Math.random() * 3);

    // Set dirt below trunk
    this.setBlock(x, y - 1, z, BLOCK_TYPES.DIRT);

    // Grow trunk
    for (let h = 0; h < height; h++) {
      this.setBlock(x, y + h, z, trunkBlock);
    }

    const leafCenterY = y + height;

    if (style === TreeStyle.OAK || style === TreeStyle.BIRCH) {
      const startY = style === TreeStyle.BIRCH ? -3 : -2;
      for (let ly = startY; ly <= 1; ly++) {
        const radius = ly === 1 ? 1 : 2;
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (lx === 0 && lz === 0 && ly <= 0) continue;

            if (style === TreeStyle.BIRCH && ly === startY && Math.abs(lx) === radius && Math.abs(lz) === radius) {
              continue;
            }

            const gx = x + lx;
            const gy = leafCenterY + ly;
            const gz = z + lz;

            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              if (Math.random() < 0.20) {
                continue;
              }
            }

            if (this.getBlock(gx, gy, gz) === BLOCK_TYPES.AIR) {
              this.setBlock(gx, gy, gz, leafBlock);
            }
          }
        }
      }
    } else if (style === TreeStyle.SPRUCE) {
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

            if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
              continue;
            }

            const gx = x + lx;
            const gy = leafCenterY + ly;
            const gz = z + lz;

            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              if (Math.random() < 0.20) {
                continue;
              }
            }

            if (this.getBlock(gx, gy, gz) === BLOCK_TYPES.AIR) {
              this.setBlock(gx, gy, gz, leafBlock);
            }
          }
        }
      }
    } else if (style === TreeStyle.JUNGLE) {
      for (let ly = -3; ly <= 1; ly++) {
        const radius = ly === 1 ? 1 : (ly === -3 ? 1 : 2);
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (lx === 0 && lz === 0 && ly <= 0) continue;

            if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
              continue;
            }

            const gx = x + lx;
            const gy = leafCenterY + ly;
            const gz = z + lz;

            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              if (Math.random() < 0.10) {
                continue;
              }
            }

            if (this.getBlock(gx, gy, gz) === BLOCK_TYPES.AIR) {
              this.setBlock(gx, gy, gz, leafBlock);
            }
          }
        }
      }
    }
  }

  private applyChunkModifications(chunkKey: string, chunk: Uint8Array): void {
    const chunkModified = this.modifiedBlocks.get(chunkKey);
    if (!chunkModified) return;

    for (const [posKey, type] of chunkModified.entries()) {
      const [lx, y, lz] = posKey.split(',').map(Number);
      const index = lx + lz * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
      chunk[index] = type;
    }
  }
}
