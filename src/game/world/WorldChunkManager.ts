import { World, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, WORLD_HEIGHT } from './World';
import { useGameStore } from '@store/useGameStore';
import { isWorkerTaskCancelledError, WorkerManager } from './worker/WorkerManager';
import type { ChunkNeighbors } from './ChunkMeshBuilder';
import {
  ChunkVisibilityResolver,
  type ChunkStreamingView,
} from './streaming/ChunkVisibilityResolver';
import { CHUNK_STREAMING_CONFIG } from './streaming/ChunkStreamingConfig';
import { ChunkWorkerRetryTracker } from './streaming/ChunkWorkerRetryTracker';
import { ChunkStreamingViewCache } from './streaming/ChunkStreamingViewCache';

interface PendingGenerationQueueItem {
  readonly key: string;
  readonly epoch: number;
  readonly revision: number;
}

export interface PendingMeshQueueItem {
  readonly key: string;
  readonly updateNeighbors: boolean;
  readonly epoch: number;
  readonly revision: number;
}

const CHUNK_NEIGHBOR_OFFSETS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

let nextWorkerTaskOwnerId = 0;

export class WorldChunkManager {
  private world: World;
  private workerManager: WorkerManager;
  private visibilityResolver = new ChunkVisibilityResolver();
  
  private generatingChunks = new Map<string, number>();
  private generatingMeshes = new Map<string, number>();
  private pendingGenerationQueue: PendingGenerationQueueItem[] = [];
  public pendingMeshQueue: PendingMeshQueueItem[] = [];
  private generationRetries = new ChunkWorkerRetryTracker(
    CHUNK_STREAMING_CONFIG.maxWorkerTaskAttempts,
  );
  private meshRetries = new ChunkWorkerRetryTracker(
    CHUNK_STREAMING_CONFIG.maxWorkerTaskAttempts,
  );
  private readonly viewCache = new ChunkStreamingViewCache();
  private streamingEpoch = 0;
  private desiredActiveKeys = new Set<string>();
  private readonly workerTaskOwner = `world-chunk-manager:${nextWorkerTaskOwnerId++}`;

  public getStreamingEpoch(): number {
    return this.streamingEpoch;
  }

  public isKeyActive(key: string): boolean {
    return this.desiredActiveKeys.has(key);
  }

  public invalidateVisibility(): void {
    this.viewCache.invalidate();
  }

  public getWorkerTaskOwner(): string {
    return this.workerTaskOwner;
  }

  private countTasksForEpoch(tasks: ReadonlyMap<string, number>, epoch: number): number {
    let count = 0;
    for (const taskEpoch of tasks.values()) {
      if (taskEpoch === epoch) count++;
    }
    return count;
  }

  private isTaskCurrent(key: string, epoch: number, revision: number, seed: string): boolean {
    return epoch === this.streamingEpoch
      && this.desiredActiveKeys.has(key)
      && revision === this.world.getChunkRevision(key)
      && seed === this.world.getSeed();
  }

  public clearCache() {
    this.viewCache.clear();
    this.streamingEpoch++;
    this.workerManager.cancelQueuedTasks(this.workerTaskOwner);
    this.desiredActiveKeys = new Set();
    this.pendingGenerationQueue = [];
    this.pendingMeshQueue = [];
    this.generatingChunks.clear();
    this.generatingMeshes.clear();
    this.generationRetries.clearAll();
    this.meshRetries.clearAll();

    const chunkMeshes = this.world.getRenderer().getChunkMeshes();
    for (const key of chunkMeshes.keys()) {
      this.world.getRenderer().removeChunkMesh(key);
    }
  }

  constructor(world: World) {
    this.world = world;
    this.workerManager = WorkerManager.getInstance();
  }

  // Resolve only when a quantized view parameter changes or topology is invalidated.
  public loadArea(
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    sync = false,
    view: ChunkStreamingView | null = null,
  ): void {
    const shouldSync = sync || !this.world.game || !this.workerManager.hasLiveWorkers();
    const worldChunkHeight = WORLD_HEIGHT / CHUNK_SIZE_Y;
    const ccx = Math.floor(centerX / CHUNK_SIZE_X);
    const ccy = Math.max(0, Math.min(worldChunkHeight - 1, Math.floor(centerY / CHUNK_SIZE_Y)));
    const ccz = Math.floor(centerZ / CHUNK_SIZE_Z);
    const resolvedRadius = Math.max(0, radius);

    const shouldResolveVisibility = this.viewCache.shouldResolve(
      ccx,
      ccy,
      ccz,
      resolvedRadius,
      view,
    );
    if (!shouldSync && !shouldResolveVisibility) {
      return;
    }

    const visibility = this.visibilityResolver.resolve({
      center: { x: ccx, y: ccy, z: ccz },
      radius: resolvedRadius,
      minChunkY: 0,
      maxChunkYExclusive: worldChunkHeight,
      view,
      positionUncertaintyRadius: view
        ? CHUNK_STREAMING_CONFIG.viewPositionBucketUncertaintyRadius
        : 0,
      directionUncertaintyRadians: view
        ? CHUNK_STREAMING_CONFIG.directionBucketUncertaintyRadians
        : 0,
      allowUnknownTraversal: shouldSync,
      getChunkState: key => this.world.getChunkVisibilityState(key),
    });
    const nextActiveKeys = new Set(visibility.active);
    let activeChanged = nextActiveKeys.size !== this.desiredActiveKeys.size;
    if (!activeChanged) {
      for (const key of nextActiveKeys) {
        if (!this.desiredActiveKeys.has(key)) {
          activeChanged = true;
          break;
        }
      }
    }
    let removedActiveKey = false;
    if (activeChanged) {
      for (const key of this.desiredActiveKeys) {
        if (!nextActiveKeys.has(key)) {
          removedActiveKey = true;
          break;
        }
      }
      this.desiredActiveKeys = nextActiveKeys;
    }
    if (removedActiveKey) {
      this.streamingEpoch++;
      this.workerManager.cancelQueuedTasks(
        this.workerTaskOwner,
        metadata => (
          metadata.epoch !== this.streamingEpoch
          || !this.desiredActiveKeys.has(metadata.key)
        ),
      );
      this.generationRetries.clearAll();
      this.meshRetries.clearAll();
    }
    const epoch = this.streamingEpoch;
    const currentSeed = this.world.getSeed();

    const store = useGameStore.getState();
    if (!shouldSync && store.isWorldLoading) {
      const loadingKeys = [...this.desiredActiveKeys];
      const currentKeys = Object.keys(store.chunkLoadingStates);
      const keysMatch = loadingKeys.length === currentKeys.length
        && loadingKeys.every(key => currentKeys.includes(key));
      if (!keysMatch) {
        store.setWorldLoadingStage('chunks');
        store.initChunkLoading(loadingKeys);
        for (const key of loadingKeys) {
          if (this.world.getRenderer().hasChunkMesh(key)) {
            store.setChunkLoadingState(key, true);
          }
        }
      }
    }

    const neededGeneration: PendingGenerationQueueItem[] = [];
    const neededMesh: PendingMeshQueueItem[] = [];
    for (const key of this.desiredActiveKeys) {
      const [cx, cy, cz] = key.split(',').map(Number);
      const revision = this.world.getChunkRevision(key);
      if (!this.world.chunks.has(key)) {
        if (shouldSync) {
          const chunk = this.world.generator.generateChunkData(cx, cy, cz);
          this.world.applyChunkModifications(key, chunk);
          this.world.chunks.set(key, chunk);
        } else if (
          this.generatingChunks.get(key) !== epoch
          && this.generationRetries.canAttempt(key, epoch, revision, currentSeed)
        ) {
          neededGeneration.push({ key, epoch, revision });
        }
        continue;
      }

      const summary = this.world.getChunkVisibilitySummary(key);
      const needsWorkerSummary = !summary || summary.chunkRevision !== revision;
      if (
        (!this.world.getRenderer().hasChunkMesh(key) || needsWorkerSummary)
        && this.generatingMeshes.get(key) !== epoch
        && this.meshRetries.canAttempt(key, epoch, revision, currentSeed)
      ) {
        neededMesh.push({ key, updateNeighbors: true, epoch, revision });
      }
    }

    if (shouldSync) {
      for (const key of this.desiredActiveKeys) {
        if (this.world.getRenderer().hasChunkMesh(key)) continue;
        const [cx, cy, cz] = key.split(',').map(Number);
        this.world.updateChunkMesh(cx, cy, cz);
      }
      this.pendingGenerationQueue = [];
      this.pendingMeshQueue = this.world.game && this.workerManager.hasLiveWorkers()
        ? neededMesh
        : [];
    } else {
      neededGeneration.sort((first, second) => (
        this.getChunkPriority(first.key, ccx, ccy, ccz)
        - this.getChunkPriority(second.key, ccx, ccy, ccz)
      ));
      neededMesh.sort((first, second) => (
        this.getChunkPriority(first.key, ccx, ccy, ccz)
        - this.getChunkPriority(second.key, ccx, ccy, ccz)
      ));
      this.pendingGenerationQueue = neededGeneration;
      this.pendingMeshQueue = neededMesh;
    }

    const chunkMeshes = this.world.getRenderer().getChunkMeshes();
    for (const key of chunkMeshes.keys()) {
      if (!this.desiredActiveKeys.has(key)) {
        this.world.getRenderer().removeChunkMesh(key);
      }
    }
  }

  public processIncrementalLoading() {
    if (!this.world.game) return;

    const startTime = performance.now();
    const store = useGameStore.getState();
    const budgetMs = store.isWorldLoading
      ? CHUNK_STREAMING_CONFIG.worldLoadingBudgetMs
      : CHUNK_STREAMING_CONFIG.gameplayBudgetMs;

    const playerX = this.world.game.player.position.x;
    const playerY = this.world.game.player.position.y;
    const playerZ = this.world.game.player.position.z;
    const ccx = Math.floor(playerX / CHUNK_SIZE_X);
    const ccy = Math.floor(playerY / CHUNK_SIZE_Y);
    const ccz = Math.floor(playerZ / CHUNK_SIZE_Z);

    while (performance.now() - startTime < budgetMs) {
      if (this.workerManager.getIdleWorkerCount() <= 0) break;
      const canScheduleMesh = this.pendingMeshQueue.length > 0
        && this.countTasksForEpoch(this.generatingMeshes, this.streamingEpoch)
          < CHUNK_STREAMING_CONFIG.maxConcurrentMeshing;
      const canScheduleGeneration = this.pendingGenerationQueue.length > 0
        && this.countTasksForEpoch(this.generatingChunks, this.streamingEpoch)
          < CHUNK_STREAMING_CONFIG.maxConcurrentGeneration;

      if (canScheduleMesh) {
        const item = this.pendingMeshQueue.shift();
        if (!item) continue;
        const { key, updateNeighbors, epoch, revision } = item;
        if (
          epoch !== this.streamingEpoch
          || !this.desiredActiveKeys.has(key)
          || revision !== this.world.getChunkRevision(key)
          || this.generatingMeshes.get(key) === epoch
        ) {
          continue;
        }

        const [cx, cy, cz] = key.split(',').map(Number);
        const chunk = this.world.chunks.get(key);
        if (!chunk) continue;
        const currentSeed = this.world.getSeed();
        const attempt = this.meshRetries.recordAttempt(key, epoch, revision, currentSeed);
        if (attempt === null) continue;
        this.generatingMeshes.set(key, epoch);

        const neighbors: ChunkNeighbors = {
          px: this.world.chunks.get(`${cx + 1},${cy},${cz}`),
          nx: this.world.chunks.get(`${cx - 1},${cy},${cz}`),
          py: this.world.chunks.get(`${cx},${cy + 1},${cz}`),
          ny: this.world.chunks.get(`${cx},${cy - 1},${cz}`),
          pz: this.world.chunks.get(`${cx},${cy},${cz + 1}`),
          nz: this.world.chunks.get(`${cx},${cy},${cz - 1}`),
        };
        const version = this.world.getRenderer().getNextVersion(key);
        this.workerManager.execute('GENERATE_MESH', {
          cx,
          cy,
          cz,
          chunk,
          neighbors,
          chunkRevision: revision,
        }, {
          metadata: {
            owner: this.workerTaskOwner,
            key,
            epoch,
            revision,
            seed: currentSeed,
          },
        }).then(result => {
          if (this.generatingMeshes.get(key) === epoch) {
            this.generatingMeshes.delete(key);
          }
          if (
            epoch !== this.streamingEpoch
            || !this.desiredActiveKeys.has(key)
            || this.world.getSeed() !== currentSeed
            || revision !== this.world.getChunkRevision(key)
          ) {
            this.meshRetries.clear(key, epoch, revision, currentSeed);
            return;
          }

          this.meshRetries.clear(key, epoch, revision, currentSeed);
          this.world.applyChunkVisibilitySummary(key, result.summary);
          this.world.getRenderer().applyMeshResult(cx, cy, cz, result.mesh, version);

          const currentStore = useGameStore.getState();
          if (
            currentStore.isWorldLoading
            && currentStore.chunkLoadingStates[key] === false
          ) {
            currentStore.setChunkLoadingState(key, true);
          }

          if (!updateNeighbors) return;
          let addedNeighbor = false;
          for (const [dx, dy, dz] of CHUNK_NEIGHBOR_OFFSETS) {
            const nkey = `${cx + dx},${cy + dy},${cz + dz}`;
            if (
              !this.desiredActiveKeys.has(nkey)
              || !this.world.getRenderer().hasChunkMesh(nkey)
              || this.pendingMeshQueue.some(queued => queued.key === nkey)
              || this.generatingMeshes.get(nkey) === epoch
            ) {
              continue;
            }
            this.pendingMeshQueue.push({
              key: nkey,
              updateNeighbors: false,
              epoch,
              revision: this.world.getChunkRevision(nkey),
            });
            addedNeighbor = true;
          }
          if (addedNeighbor) {
            const playerPosition = this.world.game.player.position;
            const currentCcx = Math.floor(playerPosition.x / CHUNK_SIZE_X);
            const currentCcy = Math.floor(playerPosition.y / CHUNK_SIZE_Y);
            const currentCcz = Math.floor(playerPosition.z / CHUNK_SIZE_Z);
            this.pendingMeshQueue.sort((first, second) => (
              this.getChunkPriority(first.key, currentCcx, currentCcy, currentCcz)
              - this.getChunkPriority(second.key, currentCcx, currentCcy, currentCcz)
            ));
          }
        }).catch((err: unknown) => {
          if (this.generatingMeshes.get(key) === epoch) {
            this.generatingMeshes.delete(key);
          }
          if (!this.isTaskCurrent(key, epoch, revision, currentSeed)) {
            this.meshRetries.clear(key, epoch, revision, currentSeed);
            return;
          }
          if (isWorkerTaskCancelledError(err)) {
            this.meshRetries.clear(key, epoch, revision, currentSeed);
            return;
          }
          if (attempt < CHUNK_STREAMING_CONFIG.maxWorkerTaskAttempts) {
            if (!this.pendingMeshQueue.some(queued => queued.key === key && queued.epoch === epoch)) {
              this.pendingMeshQueue.push(item);
              this.pendingMeshQueue.sort((first, second) => (
                this.getChunkPriority(first.key, ccx, ccy, ccz)
                - this.getChunkPriority(second.key, ccx, ccy, ccz)
              ));
            }
            return;
          }
          console.error(
            `Worker mesh failed after ${attempt} attempts for chunk ${key}`,
            err,
          );
        });
      } else if (canScheduleGeneration) {
        const item = this.pendingGenerationQueue.shift();
        if (!item) continue;
        const { key, epoch, revision } = item;
        if (
          epoch !== this.streamingEpoch
          || !this.desiredActiveKeys.has(key)
          || this.world.chunks.has(key)
          || revision !== this.world.getChunkRevision(key)
          || this.generatingChunks.get(key) === epoch
        ) {
          continue;
        }

        const [cx, cy, cz] = key.split(',').map(Number);
        const currentSeed = this.world.getSeed();
        const attempt = this.generationRetries.recordAttempt(key, epoch, revision, currentSeed);
        if (attempt === null) continue;
        this.generatingChunks.set(key, epoch);
        this.workerManager.execute('GENERATE_CHUNK', {
          cx,
          cy,
          cz,
          seed: currentSeed,
          chunkRevision: revision,
        }, {
          metadata: {
            owner: this.workerTaskOwner,
            key,
            epoch,
            revision,
            seed: currentSeed,
          },
        }).then(result => {
          if (this.generatingChunks.get(key) === epoch) {
            this.generatingChunks.delete(key);
          }
          if (
            epoch !== this.streamingEpoch
            || !this.desiredActiveKeys.has(key)
            || this.world.getSeed() !== currentSeed
            || revision !== this.world.getChunkRevision(key)
          ) {
            this.generationRetries.clear(key, epoch, revision, currentSeed);
            return;
          }
          if (!this.world.acceptGeneratedChunk(key, result.chunk, result.summary, revision)) {
            this.generationRetries.clear(key, epoch, revision, currentSeed);
            return;
          }

          this.generationRetries.clear(key, epoch, revision, currentSeed);
          const acceptedRevision = this.world.getChunkRevision(key);
          this.pendingMeshQueue.push({
            key,
            updateNeighbors: true,
            epoch,
            revision: acceptedRevision,
          });
          this.pendingMeshQueue.sort((first, second) => (
            this.getChunkPriority(first.key, ccx, ccy, ccz)
            - this.getChunkPriority(second.key, ccx, ccy, ccz)
          ));
        }).catch((err: unknown) => {
          if (this.generatingChunks.get(key) === epoch) {
            this.generatingChunks.delete(key);
          }
          if (!this.isTaskCurrent(key, epoch, revision, currentSeed)) {
            this.generationRetries.clear(key, epoch, revision, currentSeed);
            return;
          }
          if (isWorkerTaskCancelledError(err)) {
            this.generationRetries.clear(key, epoch, revision, currentSeed);
            return;
          }
          if (attempt < CHUNK_STREAMING_CONFIG.maxWorkerTaskAttempts) {
            if (!this.pendingGenerationQueue.some(
              queued => queued.key === key && queued.epoch === epoch,
            )) {
              this.pendingGenerationQueue.push(item);
              this.pendingGenerationQueue.sort((first, second) => (
                this.getChunkPriority(first.key, ccx, ccy, ccz)
                - this.getChunkPriority(second.key, ccx, ccy, ccz)
              ));
            }
            return;
          }
          console.error(
            `Worker generation failed after ${attempt} attempts for chunk ${key}`,
            err,
          );
        });
      } else {
        break;
      }
    }
  }

  public getChunkPriority(key: string, ccx: number, ccy: number, ccz: number): number {
    const [cx, cy, cz] = key.split(',').map(Number);
    const dcx = cx - ccx;
    const dcy = cy - ccy;
    const dcz = cz - ccz;
    return (dcx * dcx + dcz * dcz)
      + dcy * dcy * CHUNK_STREAMING_CONFIG.verticalPriorityMultiplier;
  }
}
