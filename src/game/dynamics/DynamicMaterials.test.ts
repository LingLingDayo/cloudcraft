import { describe, expect, test } from 'vitest';
import { BLOCK_TYPES } from '@type';
import { DynamicMaterialRegistry } from './DynamicMaterialRegistry';
import { FallingVoxelSimulation } from './FallingVoxelSimulation';
import type { DynamicMaterialDefinition, FallingVoxelWorldPort } from './DynamicMaterialRegistry';
import { DynamicMaterialSystem } from './DynamicMaterialSystem';
import { createCoreDynamicMaterialRegistry } from './CoreDynamicMaterials';

const sandDefinition: DynamicMaterialDefinition = {
  id: 'cloudcraft:sand_fall',
  blockIds: [BLOCK_TYPES.SAND],
  replaceableBlockIds: [BLOCK_TYPES.AIR, BLOCK_TYPES.WATER],
  gravity: -24,
  terminalVelocity: -35,
};

function createRegistry(): DynamicMaterialRegistry {
  const registry = new DynamicMaterialRegistry();
  registry.register(sandDefinition);
  registry.freeze();
  return registry;
}

function createWorld(
  initial: Readonly<Record<string, number>>,
  worldHeight = 512,
) {
  const blocks = new Map(Object.entries(initial));
  const writes: Array<{ x: number; y: number; z: number; blockId: number }> = [];
  const world: FallingVoxelWorldPort = {
    getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? BLOCK_TYPES.AIR,
    setBlock: (x, y, z, blockId) => {
      blocks.set(`${x},${y},${z}`, blockId);
      writes.push({ x, y, z, blockId });
    },
    isInWorldBounds: y => y >= 0 && y < worldHeight,
  };
  return { world, blocks, writes };
}

describe('DynamicMaterialRegistry', () => {
  test('resolves a registered profile by block type without changing the simulation', () => {
    const registry = createRegistry();

    expect(registry.getByBlockId(BLOCK_TYPES.SAND)).toBe(sandDefinition);
  });

  test('provides sand through the core content registry', () => {
    expect(createCoreDynamicMaterialRegistry().getByBlockId(BLOCK_TYPES.SAND)?.id)
      .toBe('cloudcraft:sand_fall');
  });

  test('registers extension definitions before freezing the core registry', () => {
    const dirtDefinition: DynamicMaterialDefinition = {
      ...sandDefinition,
      id: 'test:dirt_fall',
      blockIds: [BLOCK_TYPES.DIRT],
    };

    const registry = createCoreDynamicMaterialRegistry([dirtDefinition]);

    expect(registry.getByBlockId(BLOCK_TYPES.SAND)).toBeDefined();
    expect(registry.getByBlockId(BLOCK_TYPES.DIRT)).toBe(dirtDefinition);
    expect(() => registry.register({
      ...sandDefinition,
      id: 'test:stone_fall',
      blockIds: [BLOCK_TYPES.STONE],
    })).toThrow('dynamic material registry is frozen');
  });
});

describe('FallingVoxelSimulation', () => {
  test('detaches a supported dynamic voxel at most once', () => {
    const { world, writes } = createWorld({
      '2,3,4': BLOCK_TYPES.SAND,
      '2,2,4': BLOCK_TYPES.AIR,
    });
    const simulation = new FallingVoxelSimulation(createRegistry(), world);

    expect(simulation.tryDetach(2, 3, 4)).toBe(true);
    expect(simulation.tryDetach(2, 3, 4)).toBe(false);
    expect(writes).toEqual([
      { x: 2, y: 3, z: 4, blockId: BLOCK_TYPES.AIR },
    ]);
    expect(simulation.getActiveCount()).toBe(1);
  });

  test('updates a detached voxel continuously without intermediate world writes', () => {
    const { world, writes } = createWorld({
      '2,6,4': BLOCK_TYPES.SAND,
      '2,0,4': BLOCK_TYPES.STONE,
    });
    const simulation = new FallingVoxelSimulation(createRegistry(), world);
    simulation.tryDetach(2, 6, 4);

    simulation.update(0.05);
    const body = Array.from(simulation.getBodies())[0];

    expect(body.positionY).toBeLessThan(6.5);
    expect(body.positionY).toBeGreaterThan(5.5);
    expect(writes).toHaveLength(1);
  });

  test('writes the voxel back exactly once when it lands', () => {
    const { world, writes, blocks } = createWorld({
      '2,2,4': BLOCK_TYPES.SAND,
      '2,0,4': BLOCK_TYPES.STONE,
    });
    const simulation = new FallingVoxelSimulation(createRegistry(), world);
    simulation.tryDetach(2, 2, 4);

    simulation.update(0.5);
    simulation.update(0.5);

    expect(blocks.get('2,1,4')).toBe(BLOCK_TYPES.SAND);
    expect(writes).toEqual([
      { x: 2, y: 2, z: 4, blockId: BLOCK_TYPES.AIR },
      { x: 2, y: 1, z: 4, blockId: BLOCK_TYPES.SAND },
    ]);
    expect(simulation.getActiveCount()).toBe(0);
  });

  test('removes a voxel below the world and releases its source key', () => {
    const { world, blocks, writes } = createWorld({
      '2,0,4': BLOCK_TYPES.SAND,
    }, 4);
    const simulation = new FallingVoxelSimulation(createRegistry(), world);
    simulation.tryDetach(2, 0, 4);

    simulation.update(0.5);

    expect(simulation.getActiveCount()).toBe(0);
    expect(writes).toEqual([
      { x: 2, y: 0, z: 4, blockId: BLOCK_TYPES.AIR },
    ]);

    blocks.set('2,0,4', BLOCK_TYPES.SAND);
    expect(simulation.tryDetach(2, 0, 4)).toBe(true);
  });

  test('resets active voxels without disposing the reusable view', () => {
    const { world, blocks } = createWorld({
      '2,3,4': BLOCK_TYPES.SAND,
    });
    const renderedCounts: number[] = [];
    let disposed = false;
    const system = new DynamicMaterialSystem(createRegistry(), world, {
      sync: bodies => renderedCounts.push(Array.from(bodies).length),
      dispose: () => {
        disposed = true;
      },
    });
    system.tryActivate(2, 3, 4);

    system.reset();

    expect(system.getActiveCount()).toBe(0);
    expect(renderedCounts).toEqual([0]);
    expect(disposed).toBe(false);
    blocks.set('2,3,4', BLOCK_TYPES.SAND);
    expect(system.tryActivate(2, 3, 4)).toBe(true);
  });

  test('round-trips active voxels through a versioned snapshot without world writes', () => {
    const source = createWorld({
      '2,6,4': BLOCK_TYPES.SAND,
      '2,0,4': BLOCK_TYPES.STONE,
    });
    const simulation = new FallingVoxelSimulation(createRegistry(), source.world);
    simulation.tryDetach(2, 6, 4);
    simulation.update(0.05);

    const snapshot = simulation.createSnapshot();
    const target = createWorld({ '2,0,4': BLOCK_TYPES.STONE });
    const restored = new FallingVoxelSimulation(createRegistry(), target.world);
    restored.restoreSnapshot(snapshot);

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      bodies: [{
        blockId: BLOCK_TYPES.SAND,
        x: 2,
        z: 4,
        source: { x: 2, y: 6, z: 4 },
      }],
    });
    expect(restored.getActiveCount()).toBe(1);
    expect(Array.from(restored.getBodies())[0]).toMatchObject({
      blockId: BLOCK_TYPES.SAND,
      x: 2,
      z: 4,
    });
    expect(target.writes).toEqual([]);
  });

  test('keeps active voxels when snapshot validation fails', () => {
    const { world } = createWorld({
      '2,3,4': BLOCK_TYPES.SAND,
      '2,0,4': BLOCK_TYPES.STONE,
    });
    const simulation = new FallingVoxelSimulation(createRegistry(), world);
    simulation.tryDetach(2, 3, 4);

    expect(() => simulation.restoreSnapshot({
      schemaVersion: 1,
      bodies: [{
        blockId: BLOCK_TYPES.DIRT,
        x: 2,
        z: 4,
        positionY: 2.5,
        velocityY: -1,
        source: { x: 2, y: 3, z: 4 },
      }],
    } as never)).toThrow('Unknown dynamic block in snapshot');
    expect(simulation.getActiveCount()).toBe(1);
  });

  test('synchronizes and disposes an injected view through the system lifecycle', () => {
    const { world } = createWorld({
      '2,3,4': BLOCK_TYPES.SAND,
      '2,0,4': BLOCK_TYPES.STONE,
    });
    const renderedCounts: number[] = [];
    let disposed = false;
    const system = new DynamicMaterialSystem(createRegistry(), world, {
      sync: bodies => renderedCounts.push(Array.from(bodies).length),
      dispose: () => {
        disposed = true;
      },
    });

    system.tryActivate(2, 3, 4);
    system.update(0.05);
    system.dispose();

    expect(renderedCounts).toEqual([1, 0]);
    expect(disposed).toBe(true);
  });
});
