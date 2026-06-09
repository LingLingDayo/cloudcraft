/* eslint-disable @typescript-eslint/no-explicit-any -- Allow explicit any in unit test mocks to override WorkerManager execution */
import { vi, describe, test, expect, afterEach } from 'vitest';
import { World } from './World';

// Mock Canvas 2D context to prevent crash in jsdom environment when generating texture atlas
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
}) as any;

describe('WorldChunkManager Neighbor Mesh Re-indexing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should push loaded neighbors with existing meshes into pendingMeshQueue for updates', async () => {
    // Mock performance.now to bypass the time-slicing budget check during testing
    vi.spyOn(performance, 'now').mockReturnValue(0);

    // Create world with a test seed
    const world = new World('test-neighbor-culling');
    
    // We mock world.game to let processIncrementalLoading execute (it returns early if !world.game)
    world.game = {
      player: {
        position: { x: 0, y: 0, z: 0 }
      }
    };

    // Mock workerManager.execute to directly process generating mesh in main thread (simulating fallback)
    const { WorkerManager } = await import('./worker/WorkerManager');
    const { ChunkMeshBuilder } = await import('./ChunkMeshBuilder');
    const workerManager = WorkerManager.getInstance();
    vi.spyOn(workerManager, 'execute').mockImplementation(async (type, payload) => {
      if (type === 'GENERATE_MESH') {
        const { cx, cy, cz, chunk, neighbors } = payload as any;
        return ChunkMeshBuilder.buildMesh(cx, cy, cz, chunk, neighbors) as any;
      }
      return null as any;
    });

    // Pre-populate chunk A (0,0,0) and chunk B (1,0,0) data
    const chunkA = world.generator.generateChunkData(0, 0, 0);
    const chunkB = world.generator.generateChunkData(1, 0, 0);
    world.chunks.set('0,0,0', chunkA);
    world.chunks.set('1,0,0', chunkB);

    // Mock chunk B to already have a mesh in renderer
    // This simulates that B was generated earlier
    const mockMesh = {
      geometry: { dispose: () => {} }
    } as any;
    
    world.getRenderer().getChunkMeshes().set('1,0,0', {
      solid: mockMesh,
      transparent: mockMesh,
      cutout: mockMesh
    });

    // Verify renderer reports B has a mesh, but A does not
    expect(world.getRenderer().hasChunkMesh('1,0,0')).toBe(true);
    expect(world.getRenderer().hasChunkMesh('0,0,0')).toBe(false);

    // Enqueue chunk A for mesh generation with updateNeighbors = true
    world.chunkManager.pendingMeshQueue.push({ key: '0,0,0', updateNeighbors: true });

    // Process incremental loading (it will execute mesh generation for A)
    // In fallback mode, execute task is completed synchronously or resolved in a microtask
    world.chunkManager.processIncrementalLoading();

    // Since Web Workers fall back to synchronous resolve in test, we wait for promise resolutions
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify chunk A's mesh was generated
    expect(world.getRenderer().hasChunkMesh('0,0,0')).toBe(true);

    // Verify that B (1,0,0) was queued for mesh regeneration to cull boundary faces,
    // and its updateNeighbors is set to false to prevent infinite recursion
    const queuedB = world.chunkManager.pendingMeshQueue.find(item => item.key === '1,0,0');
    expect(queuedB).toBeDefined();
    expect(queuedB!.updateNeighbors).toBe(false);
  });
});
