import { describe, expect, test, vi } from 'vitest';
import { GameMode, ItemType } from '@type';
import {
  captureGameSaveData,
  restoreGameSaveData,
  type GameSaveRuntimePort,
} from './GameSaveData';
import type { SaveData } from './SaveManager';
import type { WeatherSnapshot } from '@game/environment/WeatherTimeline';
import { createCoreFixtureRegistry } from '@game/fixtures/FixtureDefinitions';
import { WorldFixtureManager } from '@game/fixtures/WorldFixtureManager';

function createRuntime(): GameSaveRuntimePort {
  return {
    world: {
      saveWorld: () => 'serialized-world',
      getSeed: () => 'test-save-seed',
      loadWorld: vi.fn(),
    },
    player: {
      position: {
        x: 1,
        y: 2,
        z: 3,
        set: vi.fn(),
      },
      syncCamera: vi.fn(),
    },
    entities: {
      createSnapshot: () => ({ schemaVersion: 1, entities: [] }),
      restoreSnapshot: vi.fn(),
    },
    fixtures: {
      createSnapshot: () => ({ schemaVersion: 1, fixtures: [] }),
      restoreSnapshot: vi.fn(),
    },
    environment: {
      createSnapshot: () => ({
        schemaVersion: 1,
        seed: 'test-weather-save-seed',
        elapsedSeconds: 90,
        manualWeather: null,
      }),
      restoreSnapshot: vi.fn(),
    },
  };
}

describe('GameSaveData', () => {
  test('captures world, entity and fixture contexts through one save boundary', () => {
    const save = captureGameSaveData(createRuntime(), {
      hotbar: [{ type: ItemType.APPLE, count: 1 }],
      inventory: [null],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
    });

    expect(save).toMatchObject({
      world: 'serialized-world',
      seed: 'test-save-seed',
      player: { x: 1, y: 2, z: 3 },
      entities: { schemaVersion: 1, entities: [] },
      fixtures: { schemaVersion: 1, fixtures: [] },
      weather: {
        schemaVersion: 1,
        seed: 'test-weather-save-seed',
        elapsedSeconds: 90,
        manualWeather: null,
      },
    });
  });

  test('round-trips fixture capabilities through definitions instead of snapshot data', () => {
    let nextFixtureId = 0;
    const sourceFixtures = new WorldFixtureManager(
      createCoreFixtureRegistry(),
      { canOccupy: () => true },
      undefined,
      () => `fixture-${nextFixtureId++}`,
    );
    sourceFixtures.place('cloudcraft:furnace', { x: 1, y: 2, z: 3 }, 0);
    sourceFixtures.place('cloudcraft:fabricator_bench', { x: 4, y: 5, z: 6 }, 0);
    const targetFixtures = new WorldFixtureManager(
      createCoreFixtureRegistry(),
      { canOccupy: () => true },
    );
    const sourceRuntime = { ...createRuntime(), fixtures: sourceFixtures };
    const targetRuntime = { ...createRuntime(), fixtures: targetFixtures };
    const save = captureGameSaveData(sourceRuntime, {
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
    });

    expect(save.fixtures?.fixtures.flatMap(fixture => fixture.components)).toEqual([
      { type: 'container', slots: [null, null, null] },
      { type: 'fuel', slots: [null] },
      { type: 'processor', progress: 0 },
      { type: 'container', slots: Array(9).fill(null) },
      { type: 'crafting' },
    ]);

    restoreGameSaveData(targetRuntime, save);

    const furnaceProcessor = targetFixtures.get('fixture-0')?.components
      .find(component => component.type === 'processor');
    const fabricatorCrafting = targetFixtures.get('fixture-1')?.components
      .find(component => component.type === 'crafting');
    expect(furnaceProcessor?.type === 'processor' ? furnaceProcessor.capabilities : null)
      .toEqual(['cloudcraft:heat']);
    expect(fabricatorCrafting?.type === 'crafting' ? fabricatorCrafting.capabilities : null)
      .toEqual([
        'cloudcraft:hand_assembly',
        'cloudcraft:shape',
        'cloudcraft:bind',
        'cloudcraft:stabilize',
      ]);
  });

  test('restores runtime contexts and normalizes legacy inventory length', () => {
    const runtime = createRuntime();
    const restoredStore = restoreGameSaveData(runtime, {
      world: 'legacy-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [{ type: ItemType.STONE, count: 3 }],
      inventory: [null],
      activeSlot: 0,
      gameMode: GameMode.CREATIVE,
      version: '0.3.0',
      entities: { schemaVersion: 1, entities: [] },
      fixtures: { schemaVersion: 1, fixtures: [] },
    });

    expect(runtime.world.loadWorld).toHaveBeenCalledWith('legacy-world');
    expect(runtime.player.position.set).toHaveBeenCalledWith(8, 9, 10);
    expect(runtime.player.syncCamera).toHaveBeenCalledOnce();
    expect(runtime.entities?.restoreSnapshot).toHaveBeenCalledWith({
      schemaVersion: 1,
      entities: [],
    });
    expect(runtime.fixtures.restoreSnapshot).toHaveBeenCalledWith({
      schemaVersion: 1,
      fixtures: [],
    });
    expect(runtime.environment.restoreSnapshot).not.toHaveBeenCalled();
    expect(restoredStore.inventory).toHaveLength(54);
    expect(restoredStore.selectedItem).toBe(ItemType.STONE);
  });

  test('restores a weather snapshot when the save contains one', () => {
    const runtime = createRuntime();
    const weather = {
      schemaVersion: 1 as const,
      seed: 'test-restored-weather-seed',
      elapsedSeconds: 135,
      manualWeather: 'rain' as const,
    };

    restoreGameSaveData(runtime, {
      world: 'weather-world',
      player: { x: 1, y: 2, z: 3 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      weather,
    });

    expect(runtime.environment.restoreSnapshot).toHaveBeenCalledWith(weather);
  });

  test('migrates a legacy pig entity array before restoring the runtime', () => {
    const runtime = createRuntime();
    const save = {
      world: 'legacy-pig-world',
      player: { x: 1, y: 2, z: 3 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.2.0',
      entities: [{
        id: 'legacy-pig-1',
        type: 'pig',
        x: 10,
        y: 4,
        z: 10,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 8,
        maxLife: 10,
        isPersistent: true,
        customData: { behaviorStateId: 'wandering' },
      }],
    } as unknown as SaveData;

    restoreGameSaveData(runtime, save);

    expect(runtime.entities?.restoreSnapshot).toHaveBeenCalledWith({
      schemaVersion: 1,
      entities: [{
        id: 'legacy-pig-1',
        type: 'cloudcraft:pig',
        x: 10,
        y: 4,
        z: 10,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 8,
        maxLife: 10,
        isPersistent: true,
        customData: { behaviorStateId: 'wandering' },
      }],
    });
  });

  test.each([
    ['schema', {
      schemaVersion: 2,
      seed: 'test-invalid-schema-seed',
      elapsedSeconds: 45,
      manualWeather: null,
    }],
    ['seed', {
      schemaVersion: 1,
      seed: '',
      elapsedSeconds: 45,
      manualWeather: null,
    }],
    ['elapsed time', {
      schemaVersion: 1,
      seed: 'test-invalid-elapsed-seed',
      elapsedSeconds: Number.POSITIVE_INFINITY,
      manualWeather: null,
    }],
    ['manual weather', {
      schemaVersion: 1,
      seed: 'test-invalid-manual-seed',
      elapsedSeconds: 45,
      manualWeather: 'snow',
    }],
  ])('rejects invalid weather %s before mutating any runtime context', (_field, weather) => {
    const runtime = createRuntime();
    const save: SaveData = {
      world: 'invalid-weather-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      entities: { schemaVersion: 1, entities: [] },
      fixtures: { schemaVersion: 1, fixtures: [] },
      weather: weather as unknown as WeatherSnapshot,
    };

    expect(() => restoreGameSaveData(runtime, save)).toThrow();
    expect(runtime.world.loadWorld).not.toHaveBeenCalled();
    expect(runtime.fixtures.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.entities?.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.environment.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.player.position.set).not.toHaveBeenCalled();
    expect(runtime.player.syncCamera).not.toHaveBeenCalled();
  });

  test.each([
    ['entity', {
      entities: { schemaVersion: 2, entities: [] },
    }],
    ['fixture', {
      fixtures: { schemaVersion: 2, fixtures: [] },
    }],
  ])('rejects an unsupported %s snapshot before mutating any runtime context', (_domain, snapshot) => {
    const runtime = createRuntime();
    const save = {
      world: 'future-snapshot-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      entities: { schemaVersion: 1 as const, entities: [] },
      fixtures: { schemaVersion: 1 as const, fixtures: [] },
      ...snapshot,
    } as unknown as SaveData;

    expect(() => restoreGameSaveData(runtime, save)).toThrow(/snapshot schema version/i);
    expect(runtime.world.loadWorld).not.toHaveBeenCalled();
    expect(runtime.fixtures.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.entities?.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.environment.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.player.position.set).not.toHaveBeenCalled();
    expect(runtime.player.syncCamera).not.toHaveBeenCalled();
  });

  test('rejects a malformed entity list before mutating any runtime context', () => {
    const runtime = createRuntime();
    const save = {
      world: 'malformed-entity-list-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      entities: { schemaVersion: 1, entities: null },
    } as unknown as SaveData;

    expect(() => restoreGameSaveData(runtime, save)).toThrow(/entity snapshot entities/i);
    expect(runtime.world.loadWorld).not.toHaveBeenCalled();
    expect(runtime.fixtures.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.entities?.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.environment.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.player.position.set).not.toHaveBeenCalled();
    expect(runtime.player.syncCamera).not.toHaveBeenCalled();
  });

  test('rejects malformed fixture components before mutating any runtime context', () => {
    const runtime = createRuntime();
    const save = {
      world: 'malformed-fixture-components-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      fixtures: {
        schemaVersion: 1,
        fixtures: [{
          id: 'fixture-invalid',
          definitionId: 'cloudcraft:chest',
          anchor: { x: 1, y: 2, z: 3 },
          orientation: 0,
          components: null,
        }],
      },
    } as unknown as SaveData;

    expect(() => restoreGameSaveData(runtime, save)).toThrow(/fixture snapshot components/i);
    expect(runtime.world.loadWorld).not.toHaveBeenCalled();
    expect(runtime.fixtures.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.entities?.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.environment.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.player.position.set).not.toHaveBeenCalled();
    expect(runtime.player.syncCamera).not.toHaveBeenCalled();
  });

  test.each([
    ['fractional anchor', {
      id: 'fixture-fractional-anchor',
      definitionId: 'cloudcraft:chest',
      anchor: { x: 1.5, y: 2, z: 3 },
      orientation: 0,
      components: [],
    }],
    ['negative processor progress', {
      id: 'fixture-negative-progress',
      definitionId: 'cloudcraft:furnace',
      anchor: { x: 1, y: 2, z: 3 },
      orientation: 0,
      components: [{ type: 'processor', progress: -1 }],
    }],
  ])('rejects fixture snapshot %s before loading the world', (_field, fixture) => {
    const runtime = createRuntime();
    const save = {
      world: 'invalid-fixture-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      fixtures: { schemaVersion: 1, fixtures: [fixture] },
    } as unknown as SaveData;

    expect(() => restoreGameSaveData(runtime, save)).toThrow();
    expect(runtime.world.loadWorld).not.toHaveBeenCalled();
    expect(runtime.fixtures.restoreSnapshot).not.toHaveBeenCalled();
  });

  test('rolls back every runtime domain when fixture restoration fails after world commit', () => {
    const runtime = createRuntime();
    const restoreError = new Error('fixture restore failed');
    vi.mocked(runtime.fixtures.restoreSnapshot)
      .mockImplementationOnce(() => {
        throw restoreError;
      })
      .mockImplementationOnce(() => undefined);
    const save: SaveData = {
      world: 'replacement-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      fixtures: { schemaVersion: 1, fixtures: [] },
    };

    let caughtError: unknown;
    try {
      restoreGameSaveData(runtime, save);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({ cause: restoreError });
    expect(runtime.world.loadWorld).toHaveBeenNthCalledWith(1, 'replacement-world');
    expect(runtime.world.loadWorld).toHaveBeenNthCalledWith(2, 'serialized-world');
    expect(runtime.fixtures.restoreSnapshot).toHaveBeenCalledTimes(2);
    expect(runtime.entities?.restoreSnapshot).toHaveBeenCalledWith({
      schemaVersion: 1,
      entities: [],
    });
    expect(runtime.environment.restoreSnapshot).toHaveBeenCalledWith({
      schemaVersion: 1,
      seed: 'test-weather-save-seed',
      elapsedSeconds: 90,
      manualWeather: null,
    });
    expect(runtime.player.position.set).toHaveBeenCalledWith(1, 2, 3);
    expect(runtime.player.syncCamera).toHaveBeenCalledOnce();
  });

  test('rolls back every runtime domain when entity restoration rejects an unknown species', () => {
    const runtime = createRuntime();
    const restoreError = new Error(
      'Unknown species plugin:missing-species for entity entity-from-plugin',
    );
    vi.mocked(runtime.entities!.restoreSnapshot)
      .mockImplementationOnce(() => {
        throw restoreError;
      })
      .mockImplementationOnce(() => undefined);
    const entitySnapshot = {
      schemaVersion: 1 as const,
      entities: [{
        id: 'entity-from-plugin',
        type: 'plugin:missing-species',
        x: 8,
        y: 9,
        z: 10,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 10,
        maxLife: 10,
        isPersistent: true,
      }],
    };
    const replacementWeather = {
      schemaVersion: 1 as const,
      seed: 'test-replacement-weather-seed',
      elapsedSeconds: 180,
      manualWeather: 'rain' as const,
    };
    const save: SaveData = {
      world: 'replacement-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      entities: entitySnapshot,
      fixtures: { schemaVersion: 1, fixtures: [] },
      weather: replacementWeather,
    };

    let caughtError: unknown;
    try {
      restoreGameSaveData(runtime, save);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({ cause: restoreError });
    expect(runtime.world.loadWorld).toHaveBeenNthCalledWith(1, 'replacement-world');
    expect(runtime.world.loadWorld).toHaveBeenNthCalledWith(2, 'serialized-world');
    expect(runtime.fixtures.restoreSnapshot).toHaveBeenCalledTimes(2);
    expect(runtime.entities?.restoreSnapshot).toHaveBeenNthCalledWith(1, entitySnapshot);
    expect(runtime.entities?.restoreSnapshot).toHaveBeenNthCalledWith(2, {
      schemaVersion: 1,
      entities: [],
    });
    expect(runtime.environment.restoreSnapshot).toHaveBeenCalledOnce();
    expect(runtime.environment.restoreSnapshot).toHaveBeenCalledWith({
      schemaVersion: 1,
      seed: 'test-weather-save-seed',
      elapsedSeconds: 90,
      manualWeather: null,
    });
    expect(runtime.player.position.set).toHaveBeenCalledOnce();
    expect(runtime.player.position.set).toHaveBeenCalledWith(1, 2, 3);
    expect(runtime.player.syncCamera).toHaveBeenCalledOnce();
  });

  test.each([
    ['player position', { player: { x: '8', y: 9, z: 10 } }],
    ['hotbar', { hotbar: {} }],
    ['inventory item stack', {
      inventory: [{ type: ItemType.APPLE, count: 0 }],
    }],
    ['unknown item type', {
      hotbar: [{ type: 'cloudcraft:unknown_item', count: 1 }],
    }],
    ['game mode', { gameMode: 'spectator' }],
  ])('rejects an invalid %s before mutating any runtime context', (_field, invalidData) => {
    const runtime = createRuntime();
    const save = {
      world: 'invalid-base-shape-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: '0.3.0',
      ...invalidData,
    } as unknown as SaveData;

    expect(() => restoreGameSaveData(runtime, save)).toThrow(/save data/i);
    expect(runtime.world.loadWorld).not.toHaveBeenCalled();
    expect(runtime.fixtures.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.entities?.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.environment.restoreSnapshot).not.toHaveBeenCalled();
    expect(runtime.player.position.set).not.toHaveBeenCalled();
    expect(runtime.player.syncCamera).not.toHaveBeenCalled();
  });
});
