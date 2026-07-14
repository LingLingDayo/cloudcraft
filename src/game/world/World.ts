/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { BLOCK_TYPES, getBlockProperties } from './BlockConfig';
import { BlockRegistry } from './block/BlockRegistry';
import { BlockEntityManager } from './block/BlockEntityManager';
import { WorldGenerator } from './WorldGenerator';
import { ChunkRenderer } from './ChunkRenderer';
import { WorldSerializer } from './WorldSerializer';
import { TreeStyle } from './biome/Biome';
import { useGameStore } from '@store/useGameStore';
import { isWorkerTaskCancelledError, WorkerManager } from './worker/WorkerManager';
import { WorldChunkManager } from './WorldChunkManager';
import { WorldTickManager } from './WorldTickManager';
import type { ChunkNeighbors } from './ChunkMeshBuilder';
import { createCoreDynamicMaterialRegistry } from '@game/dynamics/CoreDynamicMaterials';
import { DynamicMaterialSystem } from '@game/dynamics/DynamicMaterialSystem';
import { ThreeFallingVoxelView } from '@game/dynamics/ThreeFallingVoxelView';
import type { DynamicMaterialRegistry } from '@game/dynamics/DynamicMaterialRegistry';
import type {
  ChunkVisibilityState,
  ChunkStreamingView,
} from './streaming/ChunkVisibilityResolver';
import type { ChunkVisibilitySummary } from './streaming/ChunkVisibilitySummary';

export { BLOCK_TYPES, getBlockProperties };

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 16;
export const WORLD_HEIGHT = 512;

const CHUNK_VISIBILITY_REVISION_POLICY = {
  RETAIN_STABLE_TOPOLOGY: 'retain-stable-topology',
  DISCARD_TOPOLOGY: 'discard-topology',
} as const;

type ChunkVisibilityRevisionPolicy = typeof CHUNK_VISIBILITY_REVISION_POLICY[
  keyof typeof CHUNK_VISIBILITY_REVISION_POLICY
];

export class World {
  public game: any;
  public blockEntities: BlockEntityManager;
  public chunks: Map<string, Uint8Array>;
  public group: THREE.Group;
  
  // Track modifications: chunkKey -> relativePosKey -> blockType
  public modifiedBlocks: Map<string, Map<string, number>>;
  // Track original blocks for reverting: chunkKey -> relativePosKey -> blockType
  private originalBlocks: Map<string, Map<string, number>>;
  private chunkRevisions = new Map<string, number>();
  private chunkVisibilitySummaries = new Map<string, ChunkVisibilitySummary>();
  private chunkVisibilityFallbackSummaries = new Map<string, ChunkVisibilitySummary>();

  private seed: string;
  public generator: WorldGenerator;
  private renderer: ChunkRenderer;
  private workerManager: WorkerManager;
  
  public chunkManager: WorldChunkManager;
  public tickManager: WorldTickManager;
  public dynamicMaterials: DynamicMaterialSystem;

  constructor(
    seed = 'cloudcraft',
    game?: any,
    dynamicMaterialRegistry: DynamicMaterialRegistry = createCoreDynamicMaterialRegistry(),
  ) {
    this.seed = seed;
    this.game = game;
    this.blockEntities = new BlockEntityManager();
    this.chunks = new Map();
    this.modifiedBlocks = new Map();
    this.originalBlocks = new Map();
    this.group = new THREE.Group();
    this.dynamicMaterials = new DynamicMaterialSystem(
      dynamicMaterialRegistry,
      this,
      new ThreeFallingVoxelView(this.group),
    );
    
    this.generator = new WorldGenerator(seed);
    this.renderer = new ChunkRenderer(this);
    this.workerManager = WorkerManager.getInstance();

    this.chunkManager = new WorldChunkManager(this);
    this.tickManager = new WorldTickManager(this);
  }

  public getSeed(): string {
    return this.seed;
  }

  public isInWorldBounds(y: number): boolean {
    return y >= 0 && y < WORLD_HEIGHT;
  }

  public setSeed(seed: string): void {
    this.dynamicMaterials.reset();
    this.seed = seed;
    this.generator.setSeed(seed);
    this.chunkRevisions.clear();
    this.chunkVisibilitySummaries.clear();
    this.chunkVisibilityFallbackSummaries.clear();
    this.chunkManager.clearCache();
  }

  public getChunkRevision(key: string): number {
    return this.chunkRevisions.get(key) ?? 0;
  }

  public getChunkVisibilitySummary(key: string): ChunkVisibilitySummary | undefined {
    return this.chunkVisibilitySummaries.get(key);
  }

  public getChunkVisibilityState(key: string): ChunkVisibilityState {
    return {
      revision: this.getChunkRevision(key),
      summary: this.chunkVisibilitySummaries.get(key),
      fallbackSummary: this.chunkVisibilityFallbackSummaries.get(key),
    };
  }

  public applyChunkVisibilitySummary(key: string, summary: ChunkVisibilitySummary): boolean {
    if (summary.chunkRevision !== this.getChunkRevision(key)) return false;
    const previous = this.chunkVisibilitySummaries.get(key)
      ?? this.chunkVisibilityFallbackSummaries.get(key);
    this.chunkVisibilitySummaries.set(key, summary);
    this.chunkVisibilityFallbackSummaries.delete(key);
    if (
      !previous
      || previous.schemaVersion !== summary.schemaVersion
      || previous.openFacesMask !== summary.openFacesMask
      || previous.portalMask !== summary.portalMask
    ) {
      this.chunkManager.invalidateVisibility();
    }
    return true;
  }

  public acceptGeneratedChunk(
    key: string,
    chunk: Uint8Array,
    summary: ChunkVisibilitySummary,
    revision: number,
  ): boolean {
    if (revision !== this.getChunkRevision(key)) return false;
    this.applyChunkModifications(key, chunk);
    this.chunks.set(key, chunk);
    if (this.modifiedBlocks.has(key)) {
      this.chunkVisibilitySummaries.delete(key);
      this.chunkVisibilityFallbackSummaries.delete(key);
      this.chunkManager.invalidateVisibility();
    } else {
      this.applyChunkVisibilitySummary(key, summary);
    }
    return true;
  }

  private incrementChunkRevision(
    key: string,
    visibilityPolicy: ChunkVisibilityRevisionPolicy,
  ): number {
    const revision = this.getChunkRevision(key) + 1;
    this.chunkRevisions.set(key, revision);
    if (visibilityPolicy === CHUNK_VISIBILITY_REVISION_POLICY.RETAIN_STABLE_TOPOLOGY) {
      const stableSummary = this.chunkVisibilitySummaries.get(key);
      if (stableSummary) {
        this.chunkVisibilityFallbackSummaries.set(key, stableSummary);
      }
      this.chunkVisibilitySummaries.delete(key);
    } else {
      this.chunkVisibilitySummaries.delete(key);
      this.chunkVisibilityFallbackSummaries.delete(key);
    }
    this.chunkManager.invalidateVisibility();
    return revision;
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

    return chunk[index * 2];
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

    const oldType = chunk[index * 2];
    if (oldType === type) return;
    this.incrementChunkRevision(
      key,
      CHUNK_VISIBILITY_REVISION_POLICY.RETAIN_STABLE_TOPOLOGY,
    );

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
        const originalType = originalChunk[index * 2];
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

    chunk[index * 2] = type;
    this.chunks.set(key, chunk);

    // Recalculate sky light for the column affected
    this.recalculateColumnSkyLight(x, z);

    const newBlock = BlockRegistry.get(type);
    if (newBlock.hasBlockEntity()) {
      const entityType = type === BLOCK_TYPES.CHEST ? 'chest' : 'lever';
      this.blockEntities.createEntity(entityType, x, y, z);
    }
    newBlock.onPlaced(this, x, y, z);
    if (newBlock.affectedByGravity) {
      this.addFallingBlock(x, y, z);
    }
    this.notifyNeighborsOfStateChange(x, y, z);

    // Rebuild only the current chunk's mesh asynchronously
    this.updateChunkMeshAsync(cx, cy, cz);

    // Rebuild adjacent chunks asynchronously ONLY if the modified block is on the chunk boundary
    if (lx === 0) this.updateNeighborChunkMeshAsync(cx - 1, cy, cz);
    else if (lx === CHUNK_SIZE_X - 1) this.updateNeighborChunkMeshAsync(cx + 1, cy, cz);

    if (ly === 0) this.updateNeighborChunkMeshAsync(cx, cy - 1, cz);
    else if (ly === CHUNK_SIZE_Y - 1) this.updateNeighborChunkMeshAsync(cx, cy + 1, cz);

    if (lz === 0) this.updateNeighborChunkMeshAsync(cx, cy, cz - 1);
    else if (lz === CHUNK_SIZE_Z - 1) this.updateNeighborChunkMeshAsync(cx, cy, cz + 1);
  }

  public updateChunkMeshAsync(cx: number, cy: number, cz: number) {
    const key = `${cx},${cy},${cz}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    const revision = this.getChunkRevision(key);
    const streamingEpoch = this.chunkManager.getStreamingEpoch();
    const currentSeed = this.getSeed();
    if (this.game && !this.chunkManager.isKeyActive(key)) return;

    // Fallback when the runtime cannot keep at least one worker alive.
    if (!this.workerManager.hasLiveWorkers()) {
      this.updateChunkMesh(cx, cy, cz, false);
      return;
    }

    const neighbors: ChunkNeighbors = {
      px: this.chunks.get(`${cx + 1},${cy},${cz}`),
      nx: this.chunks.get(`${cx - 1},${cy},${cz}`),
      py: this.chunks.get(`${cx},${cy + 1},${cz}`),
      ny: this.chunks.get(`${cx},${cy - 1},${cz}`),
      pz: this.chunks.get(`${cx},${cy},${cz + 1}`),
      nz: this.chunks.get(`${cx},${cy},${cz - 1}`),
    };

    const version = this.renderer.getNextVersion(key);

    this.workerManager.execute('GENERATE_MESH', {
      cx, cy, cz, chunk, neighbors, chunkRevision: revision,
    }, {
      metadata: {
        owner: this.chunkManager.getWorkerTaskOwner(),
        key,
        epoch: streamingEpoch,
        revision,
        seed: currentSeed,
      },
    }).then(result => {
      if (
        revision !== this.getChunkRevision(key)
        || currentSeed !== this.getSeed()
        || (
          this.game
          && (
            streamingEpoch !== this.chunkManager.getStreamingEpoch()
            || !this.chunkManager.isKeyActive(key)
          )
        )
      ) {
        return;
      }
      this.applyChunkVisibilitySummary(key, result.summary);
      this.renderer.applyMeshResult(cx, cy, cz, result.mesh, version);
    }).catch((err: unknown) => {
      if (isWorkerTaskCancelledError(err)) return;
      console.error(`Failed to generate mesh asynchronously for chunk ${key}`, err);
    });
  }

  private updateNeighborChunkMeshAsync(ncx: number, ncy: number, ncz: number) {
    const nkey = `${ncx},${ncy},${ncz}`;
    if (this.renderer.hasChunkMesh(nkey)) {
      this.updateChunkMeshAsync(ncx, ncy, ncz);
    }
  }

  public updateChunkMesh(cx: number, cy: number, cz: number, updateNeighbors = true) {
    this.renderer.updateChunkMesh(cx, cy, cz, this.chunks);
    
    // Update chunk loading progress in store
    const store = useGameStore.getState();
    if (store.isWorldLoading) {
      const key = `${cx},${cy},${cz}`;
      if (store.chunkLoadingStates[key] === false) {
        store.setChunkLoadingState(key, true);
      }
    }

    if (updateNeighbors) {
      const neighbors = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
      ];
      for (const [dx, dy, dz] of neighbors) {
        const ncx = cx + dx;
        const ncy = cy + dy;
        const ncz = cz + dz;
        const nkey = `${ncx},${ncy},${ncz}`;
        if (this.renderer.hasChunkMesh(nkey)) {
          this.updateChunkMesh(ncx, ncy, ncz, false);
        }
      }
    }
  }

  // Load an area around a central chunk (generate if not existing, create meshes)
  public loadArea(
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    sync = false,
    view: ChunkStreamingView | null = null,
  ) {
    this.chunkManager.loadArea(centerX, centerY, centerZ, radius, sync, view);
  }

  // Clean up WebGL resources
  public dispose() {
    this.dynamicMaterials.dispose();
    this.renderer.dispose();
    this.workerManager.dispose();
  }

  // Serialize world to JSON (only saves modified blocks to keep save size minimal)
  public saveWorld(): string {
    return WorldSerializer.saveWorld(this);
  }

  // Load world from JSON
  public loadWorld(saveStr: string) {
    WorldSerializer.loadWorld(this, saveStr);
    this.chunkManager.clearCache();
  }

  public addFallingBlock(x: number, y: number, z: number): boolean {
    return this.dynamicMaterials.tryActivate(x, y, z);
  }

  public update(dt: number) {
    this.chunkManager.processIncrementalLoading();
    this.dynamicMaterials.update(dt);
    this.tickManager.update(dt);
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
      if (neighborBlock.affectedByGravity) {
        this.addFallingBlock(nx, ny, nz);
      }
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
    this.tickManager.registerSapling(x, y, z, saplingType);
  }

  public unregisterSapling(x: number, y: number, z: number) {
    this.tickManager.unregisterSapling(x, y, z);
  }

  public checkLeafDecay(x: number, y: number, z: number) {
    this.tickManager.checkLeafDecay(x, y, z);
  }

  public isConnectedToWood(startX: number, startY: number, startZ: number): boolean {
    return this.tickManager.isConnectedToWood(startX, startY, startZ);
  }

  public spawnTree(
    x: number,
    y: number,
    z: number,
    trunkBlock: number,
    leafBlock: number,
    style: TreeStyle
  ): void {
    this.tickManager.spawnTree(x, y, z, trunkBlock, leafBlock, style);
  }

  public applyChunkModifications(chunkKey: string, chunk: Uint8Array): void {
    const chunkModified = this.modifiedBlocks.get(chunkKey);
    if (!chunkModified) return;

    let changed = false;
    for (const [posKey, type] of chunkModified.entries()) {
      const [lx, y, lz] = posKey.split(',').map(Number);
      const index = lx + lz * CHUNK_SIZE_X + y * CHUNK_SIZE_X * CHUNK_SIZE_Z;
      if (chunk[index * 2] === type) continue;
      chunk[index * 2] = type;
      changed = true;
    }
    if (changed) {
      this.incrementChunkRevision(
        chunkKey,
        CHUNK_VISIBILITY_REVISION_POLICY.DISCARD_TOPOLOGY,
      );
    }
  }

  public recalculateColumnSkyLight(x: number, z: number): void {
    let currentSkyLight = 15;
    const chunksToUpdate = new Set<string>();

    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const cx = Math.floor(x / CHUNK_SIZE_X);
      const cy = Math.floor(y / CHUNK_SIZE_Y);
      const cz = Math.floor(z / CHUNK_SIZE_Z);
      const key = `${cx},${cy},${cz}`;

      const chunk = this.chunks.get(key);
      if (!chunk) continue;

      const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
      const ly = ((y % CHUNK_SIZE_Y) + CHUNK_SIZE_Y) % CHUNK_SIZE_Y;
      const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
      const index = lx + lz * CHUNK_SIZE_X + ly * CHUNK_SIZE_X * CHUNK_SIZE_Z;

      const blockRaw = chunk[index * 2];
      const blockType = blockRaw & 0x3F;
      const isTrans = blockType === BLOCK_TYPES.AIR || this.isTransparent(blockType);

      if (!isTrans) {
        currentSkyLight = Math.max(0, currentSkyLight - 3);
      } else if (
        blockType === BLOCK_TYPES.LEAF ||
        blockType === BLOCK_TYPES.BIRCH_LEAVES ||
        blockType === BLOCK_TYPES.SPRUCE_LEAVES ||
        blockType === BLOCK_TYPES.JUNGLE_LEAVES
      ) {
        currentSkyLight = Math.max(0, currentSkyLight - 1);
      }

      const oldLight = chunk[index * 2 + 1];
      const oldBlockLight = oldLight & 0x0F;
      const nextLight = (currentSkyLight << 4) | oldBlockLight;

      if (oldLight !== nextLight) {
        chunk[index * 2 + 1] = nextLight;
        chunksToUpdate.add(key);
      }
    }

    for (const key of chunksToUpdate) {
      const [cx, cy, cz] = key.split(',').map(Number);
      this.updateChunkMeshAsync(cx, cy, cz);
    }
  }

  public getChunkPriority(key: string, ccx: number, ccy: number, ccz: number): number {
    return this.chunkManager.getChunkPriority(key, ccx, ccy, ccz);
  }
}
