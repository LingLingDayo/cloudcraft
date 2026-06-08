import { World, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, WORLD_HEIGHT } from './World';
import { useGameStore } from '@store/useGameStore';
import { WorkerManager } from './worker/WorkerManager';

export class WorldChunkManager {
  private world: World;
  private workerManager: WorkerManager;
  
  private generatingChunks: Set<string> = new Set();
  private pendingGenerationQueue: string[] = [];
  public pendingMeshQueue: string[] = []; // Used for incremental loading

  constructor(world: World) {
    this.world = world;
    this.workerManager = WorkerManager.getInstance();
  }

  // Load an area around a central chunk (generate if not existing, create meshes)
  public loadArea(centerX: number, centerY: number, centerZ: number, radius: number, sync = false) {
    const shouldSync = sync || !this.world.game;
    const ccx = Math.floor(centerX / CHUNK_SIZE_X);
    const ccy = Math.floor(centerY / CHUNK_SIZE_Y);
    const ccz = Math.floor(centerZ / CHUNK_SIZE_Z);

    const activeKeys = new Set<string>();
    const neededGeneration: string[] = [];
    const radiusSq = radius * radius;

    // Initialize loading progress for this area if we are in world loading screen and asynchronous
    if (!shouldSync) {
      const store = useGameStore.getState();
      if (store.isWorldLoading) {
        const keys: string[] = [];
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
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
            if (this.world.getRenderer().hasChunkMesh(key)) {
              store.setChunkLoadingState(key, true);
            }
          });
        }
      }
    }

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
          const cx = ccx + dx;
          const cy = ccy + dy;
          const cz = ccz + dz;
          if (cy < 0 || cy >= WORLD_HEIGHT / CHUNK_SIZE_Y) continue;

          const key = `${cx},${cy},${cz}`;
          activeKeys.add(key);

          if (shouldSync) {
            if (!this.world.chunks.has(key)) {
              const chunk = this.world.generator.generateChunkData(cx, cy, cz);
              this.world.applyChunkModifications(key, chunk);
              this.world.chunks.set(key, chunk);
            }
          } else {
            if (!this.world.chunks.has(key)) {
              neededGeneration.push(key);
            }
          }
        }
      }
    }

    if (shouldSync) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
            const cx = ccx + dx;
            const cy = ccy + dy;
            const cz = ccz + dz;
            if (cy < 0 || cy >= WORLD_HEIGHT / CHUNK_SIZE_Y) continue;

            const key = `${cx},${cy},${cz}`;
            const hasMesh = this.world.getRenderer().hasChunkMesh(key);
            if (!hasMesh) {
              this.world.updateChunkMesh(cx, cy, cz);
            } else {
              const currentLOD = this.world.getRenderer().getChunkLOD(key);
              const targetLOD = this.world.getRenderer().getLODStep(cx, cy, cz);
              if (currentLOD !== undefined && currentLOD !== targetLOD) {
                this.world.updateChunkMesh(cx, cy, cz);
              }
            }
          }
        }
      }
      this.pendingGenerationQueue = [];
      this.pendingMeshQueue = [];
    } else {
      const neededMesh: string[] = [];
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
            const cx = ccx + dx;
            const cy = ccy + dy;
            const cz = ccz + dz;
            if (cy < 0 || cy >= WORLD_HEIGHT / CHUNK_SIZE_Y) continue;

            const key = `${cx},${cy},${cz}`;
            if (this.world.chunks.has(key)) {
              const hasMesh = this.world.getRenderer().hasChunkMesh(key);
              if (!hasMesh) {
                neededMesh.push(key);
              } else {
                const currentLOD = this.world.getRenderer().getChunkLOD(key);
                const targetLOD = this.world.getRenderer().getLODStep(cx, cy, cz);
                if (currentLOD !== undefined && currentLOD !== targetLOD) {
                  neededMesh.push(key);
                }
              }
            }
          }
        }
      }

      neededGeneration.sort((a, b) => this.getChunkPriority(a, ccx, ccy, ccz) - this.getChunkPriority(b, ccx, ccy, ccz));
      neededMesh.sort((a, b) => this.getChunkPriority(a, ccx, ccy, ccz) - this.getChunkPriority(b, ccx, ccy, ccz));

      this.pendingGenerationQueue = neededGeneration;
      this.pendingMeshQueue = neededMesh;
    }

    // Unload chunks that are too far away
    const chunkMeshes = this.world.getRenderer().getChunkMeshes();
    for (const key of chunkMeshes.keys()) {
      if (!activeKeys.has(key)) {
        this.world.getRenderer().removeChunkMesh(key);
      }
    }
  }

  public processIncrementalLoading() {
    if (!this.world.game) return;

    const startTime = performance.now();
    const BUDGET_MS = 8; // Max time budget in ms per frame for loading chunks

    const playerX = this.world.game.player.position.x;
    const playerY = this.world.game.player.position.y;
    const playerZ = this.world.game.player.position.z;
    const ccx = Math.floor(playerX / CHUNK_SIZE_X);
    const ccy = Math.floor(playerY / CHUNK_SIZE_Y);
    const ccz = Math.floor(playerZ / CHUNK_SIZE_Z);

    while (performance.now() - startTime < BUDGET_MS) {
      if (this.pendingMeshQueue.length > 0) {
        const key = this.pendingMeshQueue.shift();
        if (key) {
          const [cx, cy, cz] = key.split(',').map(Number);
          if (this.world.chunks.has(key)) {
            this.world.updateChunkMesh(cx, cy, cz);
          }
        }
      } else if (this.pendingGenerationQueue.length > 0) {
        const key = this.pendingGenerationQueue.shift();
        if (key && !this.world.chunks.has(key) && !this.generatingChunks.has(key)) {
          this.generatingChunks.add(key);
          const [cx, cy, cz] = key.split(',').map(Number);
          
          this.workerManager.execute<Uint8Array>('GENERATE_CHUNK', { cx, cy, cz, seed: this.world.getSeed() })
            .then(chunk => {
              this.generatingChunks.delete(key);
              this.world.applyChunkModifications(key, chunk);
              this.world.chunks.set(key, chunk);

              // Once generated, queue it for mesh creation and re-sort by proximity
              this.pendingMeshQueue.push(key);
              this.pendingMeshQueue.sort((a, b) => this.getChunkPriority(a, ccx, ccy, ccz) - this.getChunkPriority(b, ccx, ccy, ccz));
            })
            .catch(err => {
              console.error(`Failed to generate chunk asynchronously for key ${key}`, err);
              this.generatingChunks.delete(key);
            });
        }
      } else {
        break; // No more items to load
      }
    }
  }

  public getChunkPriority(key: string, ccx: number, ccy: number, ccz: number): number {
    const [cx, cy, cz] = key.split(',').map(Number);
    const dcx = cx - ccx;
    const dcy = cy - ccy;
    const dcz = cz - ccz;
    // Prioritize chunks closer horizontally first, and prioritize chunks closer to player's Y plane.
    // We give a high weight to Y distance so Y-axis distance is minimized first (dcy === 0 loads first).
    return Math.abs(dcy) * 1000 + (dcx * dcx + dcz * dcz);
  }
}
