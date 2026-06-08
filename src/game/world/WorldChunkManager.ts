import { World, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, WORLD_HEIGHT } from './World';
import { useGameStore } from '@store/useGameStore';
import { WorkerManager } from './worker/WorkerManager';
import type { ChunkMeshResult, ChunkNeighbors } from './ChunkMeshBuilder';

export class WorldChunkManager {
  private world: World;
  private workerManager: WorkerManager;
  
  private generatingChunks: Set<string> = new Set();
  private generatingMeshes: Set<string> = new Set();
  private pendingGenerationQueue: string[] = [];
  public pendingMeshQueue: Array<{ key: string; updateNeighbors: boolean }> = []; // Used for incremental loading

  private lastCcx: number | null = null;
  private lastCcy: number | null = null;
  private lastCcz: number | null = null;
  private lastRadius: number | null = null;

  public clearCache() {
    this.lastCcx = null;
    this.lastCcy = null;
    this.lastCcz = null;
    this.lastRadius = null;
  }

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

    if (!shouldSync) {
      if (
        this.lastCcx === ccx &&
        this.lastCcy === ccy &&
        this.lastCcz === ccz &&
        this.lastRadius === radius
      ) {
        return;
      }
      this.lastCcx = ccx;
      this.lastCcy = ccy;
      this.lastCcz = ccz;
      this.lastRadius = radius;
    } else {
      this.clearCache();
    }

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
              }
            }
          }
        }
      }

      neededGeneration.sort((a, b) => this.getChunkPriority(a, ccx, ccy, ccz) - this.getChunkPriority(b, ccx, ccy, ccz));
      neededMesh.sort((a, b) => this.getChunkPriority(a, ccx, ccy, ccz) - this.getChunkPriority(b, ccx, ccy, ccz));

      this.pendingGenerationQueue = neededGeneration;
      this.pendingMeshQueue = neededMesh.map(key => ({ key, updateNeighbors: true }));
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
    const store = useGameStore.getState();
    const BUDGET_MS = store.isWorldLoading ? 50 : 8; // Loading map gets 50ms budget, in-game gets 8ms

    const playerX = this.world.game.player.position.x;
    const playerY = this.world.game.player.position.y;
    const playerZ = this.world.game.player.position.z;
    const ccx = Math.floor(playerX / CHUNK_SIZE_X);
    const ccy = Math.floor(playerY / CHUNK_SIZE_Y);
    const ccz = Math.floor(playerZ / CHUNK_SIZE_Z);

    while (performance.now() - startTime < BUDGET_MS) {
      if (this.pendingMeshQueue.length > 0) {
        const item = this.pendingMeshQueue.shift();
        if (item) {
          const { key, updateNeighbors } = item;
          if (!this.generatingMeshes.has(key)) {
            const [cx, cy, cz] = key.split(',').map(Number);
            const chunk = this.world.chunks.get(key);
            if (chunk) {
              this.generatingMeshes.add(key);
              
              // Collect neighbors package
              const neighbors: ChunkNeighbors = {
                px: this.world.chunks.get(`${cx + 1},${cy},${cz}`),
                nx: this.world.chunks.get(`${cx - 1},${cy},${cz}`),
                py: this.world.chunks.get(`${cx},${cy + 1},${cz}`),
                ny: this.world.chunks.get(`${cx},${cy - 1},${cz}`),
                pz: this.world.chunks.get(`${cx},${cy},${cz + 1}`),
                nz: this.world.chunks.get(`${cx},${cy},${cz - 1}`),
              };

              this.workerManager.execute<ChunkMeshResult>('GENERATE_MESH', {
                cx, cy, cz, chunk, neighbors
              }).then(meshResult => {
                this.generatingMeshes.delete(key);
                this.world.getRenderer().applyMeshResult(cx, cy, cz, meshResult);

                // Update chunk loading progress in store
                if (store.isWorldLoading) {
                  if (store.chunkLoadingStates[key] === false) {
                    store.setChunkLoadingState(key, true);
                  }
                }

                // Update neighbors if required to ensure boundary faces are culled correctly
                if (updateNeighbors) {
                  const directions = [
                    [1, 0, 0], [-1, 0, 0],
                    [0, 1, 0], [0, -1, 0],
                    [0, 0, 1], [0, 0, -1]
                  ];
                  let addedNeighbor = false;
                  for (const [dx, dy, dz] of directions) {
                    const ncx = cx + dx;
                    const ncy = cy + dy;
                    const ncz = cz + dz;
                    const nkey = `${ncx},${ncy},${ncz}`;
                    if (this.world.getRenderer().hasChunkMesh(nkey)) {
                      const isAlreadyQueued = this.pendingMeshQueue.some(q => q.key === nkey);
                      if (!isAlreadyQueued && !this.generatingMeshes.has(nkey)) {
                        this.pendingMeshQueue.push({ key: nkey, updateNeighbors: false });
                        addedNeighbor = true;
                      }
                    }
                  }
                  if (addedNeighbor && this.world.game) {
                    const pX = this.world.game.player.position.x;
                    const pY = this.world.game.player.position.y;
                    const pZ = this.world.game.player.position.z;
                    const currentCcx = Math.floor(pX / CHUNK_SIZE_X);
                    const currentCcy = Math.floor(pY / CHUNK_SIZE_Y);
                    const currentCcz = Math.floor(pZ / CHUNK_SIZE_Z);
                    this.pendingMeshQueue.sort((a, b) => this.getChunkPriority(a.key, currentCcx, currentCcy, currentCcz) - this.getChunkPriority(b.key, currentCcx, currentCcy, currentCcz));
                  }
                }
              }).catch(err => {
                console.error(`Failed to generate mesh asynchronously for key ${key}`, err);
                this.generatingMeshes.delete(key);
              });
            }
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
              this.pendingMeshQueue.push({ key, updateNeighbors: true });
              this.pendingMeshQueue.sort((a, b) => this.getChunkPriority(a.key, ccx, ccy, ccz) - this.getChunkPriority(b.key, ccx, ccy, ccz));
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
