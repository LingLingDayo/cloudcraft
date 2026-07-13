import { describe, expect, test, vi } from 'vitest';
import { ItemType } from '@type';
import { FixtureRegistry } from './FixtureRegistry';
import { WorldFixtureManager } from './WorldFixtureManager';
import type {
  FixtureSnapshot,
  FixtureWorldPort,
} from './FixtureTypes';
import { createCoreFixtureRegistry } from './FixtureDefinitions';
import {
  createChestSnapshotEntry,
  TEST_CHEST_FIXTURE_DEFINITION as chestDefinition,
} from './FixtureTestFixtures';

describe('WorldFixtureManager', () => {
  test('reserves fixture footprint independently from voxel data and releases it on removal', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const world: FixtureWorldPort = {
      canOccupy: () => true,
    };
    let nextId = 0;
    const manager = new WorldFixtureManager(registry, world, undefined, () => `fixture-${nextId++}`);

    const first = manager.place('cloudcraft:chest', { x: 4, y: 8, z: 12 }, 0);
    const overlapping = manager.place('cloudcraft:chest', { x: 4, y: 8, z: 12 }, 0);

    expect(first).toEqual({ ok: true, fixtureId: 'fixture-0' });
    expect(overlapping).toEqual({ ok: false, reason: 'occupied' });
    expect(manager.getAt({ x: 4, y: 8, z: 12 })?.definitionId).toBe('cloudcraft:chest');

    expect(manager.remove('fixture-0')).toBe(true);
    expect(manager.getAt({ x: 4, y: 8, z: 12 })).toBeUndefined();
  });

  test('preserves the existing fixture when the id factory returns a duplicate', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      undefined,
      () => 'fixture-duplicate',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);

    expect(() => manager.place(
      chestDefinition.id,
      { x: 8, y: 9, z: 10 },
      0,
    )).toThrow('Duplicate fixture id');
    expect(manager.getAt({ x: 1, y: 2, z: 3 })?.anchor).toEqual({ x: 1, y: 2, z: 3 });
    expect(manager.getAt({ x: 8, y: 9, z: 10 })).toBeUndefined();
  });

  test.each([
    ['non-finite anchor', { x: Number.POSITIVE_INFINITY, y: 2, z: 3 }, 0],
    ['non-grid anchor', { x: 1.5, y: 2, z: 3 }, 0],
    ['orientation', { x: 1, y: 2, z: 3 }, 4],
  ])('rejects invalid placement %s before creating runtime state', (_case, anchor, orientation) => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const canOccupy = vi.fn(() => true);
    const createId = vi.fn(() => 'fixture-invalid-placement');
    const manager = new WorldFixtureManager(registry, { canOccupy }, undefined, createId);

    expect(manager.place(
      chestDefinition.id,
      anchor,
      orientation as never,
    )).toEqual({ ok: false, reason: 'invalid_placement' });
    expect(canOccupy).not.toHaveBeenCalled();
    expect(createId).not.toHaveBeenCalled();
    expect(manager.get('fixture-invalid-placement')).toBeUndefined();
  });

  test('rolls back runtime state when attaching the fixture view fails', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const view = {
      attach: vi.fn(() => {
        throw new Error('attach failed');
      }),
      detach: vi.fn(),
      dispose: vi.fn(),
    };
    let nextId = 0;
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      view,
      () => `fixture-${nextId++}`,
    );

    expect(() => manager.place(
      chestDefinition.id,
      { x: 1, y: 2, z: 3 },
      0,
    )).toThrow('attach failed');
    expect(manager.get('fixture-0')).toBeUndefined();
    expect(manager.getAt({ x: 1, y: 2, z: 3 })).toBeUndefined();
    expect(view.detach).toHaveBeenCalledWith('fixture-0');
  });

  test('restores component state and occupancy from a versioned fixture snapshot', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const world: FixtureWorldPort = { canOccupy: () => true };
    const source = new WorldFixtureManager(registry, world, undefined, () => 'fixture-saved');
    source.place('cloudcraft:chest', { x: 2, y: 3, z: 4 }, 0);
    const container = source.get('fixture-saved')?.components.find(component => component.type === 'container');
    if (!container || container.type !== 'container') throw new Error('Container missing');
    container.slots[0] = { type: ItemType.APPLE, count: 3 };

    const restored = new WorldFixtureManager(registry, world);
    restored.restoreSnapshot(source.createSnapshot());

    const restoredFixture = restored.getAt({ x: 2, y: 3, z: 4 });
    const restoredContainer = restoredFixture?.components.find(component => component.type === 'container');
    expect(restoredFixture?.id).toBe('fixture-saved');
    expect(restoredContainer?.type === 'container' ? restoredContainer.slots[0] : null)
      .toEqual({ type: ItemType.APPLE, count: 3 });
  });

  test('rolls back domain and view state when the second restored view fails to attach', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const mountedFixtureIds = new Set<string>();
    const restoreError = new Error('second restore attach failed');
    let restoring = false;
    const view = {
      attach: vi.fn((fixture: { readonly id: string }) => {
        if (restoring && fixture.id === 'fixture-new-2') throw restoreError;
        mountedFixtureIds.add(fixture.id);
      }),
      detach: vi.fn((fixtureId: string) => {
        mountedFixtureIds.delete(fixtureId);
      }),
      dispose: vi.fn(),
    };
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      view,
      () => 'fixture-current',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);
    restoring = true;

    let caughtError: unknown;
    try {
      manager.restoreSnapshot({
        schemaVersion: 1,
        fixtures: [
          createChestSnapshotEntry('fixture-new-1', { x: 4, y: 5, z: 6 }),
          createChestSnapshotEntry('fixture-new-2', { x: 8, y: 9, z: 10 }),
        ],
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({ cause: restoreError });
    expect(manager.getAt({ x: 1, y: 2, z: 3 })?.id).toBe('fixture-current');
    expect(manager.getAt({ x: 4, y: 5, z: 6 })).toBeUndefined();
    expect(manager.getAt({ x: 8, y: 9, z: 10 })).toBeUndefined();
    expect(mountedFixtureIds).toEqual(new Set(['fixture-current']));
    expect(view.detach).toHaveBeenCalledWith('fixture-new-1');
    expect(view.detach).toHaveBeenCalledWith('fixture-new-2');
    expect(view.attach.mock.calls.map(([fixture]) => fixture.id)).toEqual([
      'fixture-current',
      'fixture-new-1',
      'fixture-new-2',
      'fixture-current',
    ]);
  });

  test('keeps domain state and aggregates errors when restoring the old view also fails', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const restoreError = new Error('second restore attach failed');
    const rollbackError = new Error('old view reattach failed');
    let restoring = false;
    const view = {
      attach: vi.fn((fixture: { readonly id: string }) => {
        if (restoring && fixture.id === 'fixture-new-2') throw restoreError;
        if (restoring && fixture.id === 'fixture-current') throw rollbackError;
      }),
      detach: vi.fn(),
      dispose: vi.fn(),
    };
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      view,
      () => 'fixture-current',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);
    restoring = true;

    let caughtError: unknown;
    try {
      manager.restoreSnapshot({
        schemaVersion: 1,
        fixtures: [
          createChestSnapshotEntry('fixture-new-1', { x: 4, y: 5, z: 6 }),
          createChestSnapshotEntry('fixture-new-2', { x: 8, y: 9, z: 10 }),
        ],
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(AggregateError);
    expect(caughtError).toMatchObject({
      cause: restoreError,
      errors: [restoreError, rollbackError],
    });
    expect(manager.getAt({ x: 1, y: 2, z: 3 })?.id).toBe('fixture-current');
    expect(manager.getAt({ x: 4, y: 5, z: 6 })).toBeUndefined();
    expect(manager.getAt({ x: 8, y: 9, z: 10 })).toBeUndefined();
  });

  test('keeps current fixtures when a snapshot cannot be restored', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      undefined,
      () => 'fixture-current',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);

    expect(() => manager.restoreSnapshot({
      schemaVersion: 1,
      fixtures: [{
        id: 'fixture-invalid',
        definitionId: 'cloudcraft:unknown',
        anchor: { x: 8, y: 9, z: 10 },
        orientation: 0,
        components: [],
      }],
    })).toThrow('Unknown fixture definition in snapshot');

    expect(manager.getAt({ x: 1, y: 2, z: 3 })?.id).toBe('fixture-current');
  });

  test('rejects duplicate snapshot ids without replacing current fixtures', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      undefined,
      () => 'fixture-current',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);
    const components = [{ type: 'container' as const, slots: Array(27).fill(null) }];

    expect(() => manager.restoreSnapshot({
      schemaVersion: 1,
      fixtures: [
        {
          id: 'fixture-duplicate',
          definitionId: chestDefinition.id,
          anchor: { x: 4, y: 5, z: 6 },
          orientation: 0,
          components,
        },
        {
          id: 'fixture-duplicate',
          definitionId: chestDefinition.id,
          anchor: { x: 8, y: 9, z: 10 },
          orientation: 0,
          components,
        },
      ],
    })).toThrow('duplicate id');
    expect(manager.getAt({ x: 1, y: 2, z: 3 })?.id).toBe('fixture-current');
  });

  test.each([
    ['orientation', { orientation: 4 }],
    ['finite coordinate', { anchor: { x: Number.POSITIVE_INFINITY, y: 9, z: 10 } }],
    ['grid coordinate', { anchor: { x: 8.5, y: 9, z: 10 } }],
    ['component count', { components: [] }],
    ['component kind', {
      components: [{ type: 'fuel', slots: Array(27).fill(null) }],
    }],
    ['slot capacity', {
      components: [{ type: 'container', slots: [{ type: ItemType.APPLE, count: 1 }] }],
    }],
    ['slot item type', {
      components: [{
        type: 'container',
        slots: [{ type: 'cloudcraft:unknown', count: 1 }, ...Array(26).fill(null)],
      }],
    }],
    ['slot item count', {
      components: [{
        type: 'container',
        slots: [{ type: ItemType.APPLE, count: 0 }, ...Array(26).fill(null)],
      }],
    }],
  ])('rejects invalid fixture snapshot %s without changing current state', (_field, override) => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      undefined,
      () => 'fixture-current',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);
    const fixture = {
      id: 'fixture-invalid',
      definitionId: chestDefinition.id,
      anchor: { x: 8, y: 9, z: 10 },
      orientation: 0,
      components: [{ type: 'container', slots: Array(27).fill(null) }],
      ...override,
    };

    expect(() => manager.restoreSnapshot({
      schemaVersion: 1,
      fixtures: [fixture],
    } as unknown as FixtureSnapshot)).toThrow();
    expect(manager.getAt({ x: 1, y: 2, z: 3 })?.id).toBe('fixture-current');
    expect(manager.get('fixture-invalid')).toBeUndefined();
  });

  test('stores only mutable component state and restores capabilities from definitions', () => {
    const registry = createCoreFixtureRegistry();
    const source = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      undefined,
      () => 'fixture-furnace',
    );
    source.place('cloudcraft:furnace', { x: 3, y: 4, z: 5 }, 0);

    const snapshot = source.createSnapshot();
    expect(snapshot.fixtures[0].components).toEqual([
      { type: 'container', slots: Array(3).fill(null) },
      { type: 'fuel', slots: [null] },
      { type: 'processor', progress: 0 },
    ]);

    const restored = new WorldFixtureManager(registry, { canOccupy: () => true });
    restored.restoreSnapshot(snapshot);
    const processor = restored.get('fixture-furnace')?.components
      .find(component => component.type === 'processor');
    expect(processor?.type === 'processor' ? processor.capabilities : null)
      .toEqual(['cloudcraft:heat']);
  });

  test('replaces container slots through the manager without exposing storage ownership', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      undefined,
      () => 'fixture-container',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);
    const slots = Array(27).fill(null);
    slots[0] = { type: ItemType.APPLE, count: 2 };

    expect(manager.setContainerSlots('fixture-container', slots)).toBe(true);
    slots[0].count = 9;

    const container = manager.get('fixture-container')?.components
      .find(component => component.type === 'container');
    expect(container?.type === 'container' ? container.slots[0] : null)
      .toEqual({ type: ItemType.APPLE, count: 2 });
    expect(container?.type === 'container' ? container.slots.length : 0).toBe(27);
  });

  test('rejects container updates that change the registered slot capacity', () => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      undefined,
      () => 'fixture-container',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);

    expect(manager.setContainerSlots('fixture-container', [
      { type: ItemType.APPLE, count: 2 },
    ])).toBe(false);

    const container = manager.get('fixture-container')?.components
      .find(component => component.type === 'container');
    expect(container?.type === 'container' ? container.slots : null)
      .toEqual(Array(27).fill(null));
  });

  test.each([
    ['item type', { type: 'cloudcraft:unknown', count: 1 }],
    ['zero count', { type: ItemType.APPLE, count: 0 }],
    ['fractional count', { type: ItemType.APPLE, count: 1.5 }],
  ])('rejects container updates with an invalid %s', (_case, invalidStack) => {
    const registry = new FixtureRegistry();
    registry.register(chestDefinition);
    const manager = new WorldFixtureManager(
      registry,
      { canOccupy: () => true },
      undefined,
      () => 'fixture-container',
    );
    manager.place(chestDefinition.id, { x: 1, y: 2, z: 3 }, 0);
    const slots = [invalidStack, ...Array(26).fill(null)];

    expect(manager.setContainerSlots('fixture-container', slots as never)).toBe(false);
    const container = manager.get('fixture-container')?.components
      .find(component => component.type === 'container');
    expect(container?.type === 'container' ? container.slots : null)
      .toEqual(Array(27).fill(null));
  });
});
