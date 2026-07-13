import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GameMode, ItemType } from '@type';
import { useGameStore } from '@store/useGameStore';
import type { GameSaveRuntimePort } from '@game/systems/GameSaveData';
import type { SaveData } from '@game/systems/SaveManager';
import { GameSaveCoordinator } from './GameSaveCoordinator';

function createRuntime(): GameSaveRuntimePort {
  return {
    world: {
      saveWorld: () => 'coordinator-world',
      getSeed: () => 'test-coordinator-seed',
      loadWorld: vi.fn(),
    },
    player: {
      position: { x: 4, y: 5, z: 6, set: vi.fn() },
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
        seed: 'test-coordinator-weather-seed',
        elapsedSeconds: 30,
        manualWeather: null,
      }),
      restoreSnapshot: vi.fn(),
    },
  };
}

describe('GameSaveCoordinator', () => {
  beforeEach(() => {
    useGameStore.setState({
      hotbar: [{ type: ItemType.APPLE, count: 2 }],
      inventory: [null],
      activeSlot: 0,
      selectedItem: ItemType.APPLE,
      gameMode: GameMode.ADVENTURE,
    });
  });

  test('captures every runtime domain and the current store state', () => {
    const save = new GameSaveCoordinator(createRuntime()).capture();

    expect(save).toMatchObject({
      world: 'coordinator-world',
      seed: 'test-coordinator-seed',
      player: { x: 4, y: 5, z: 6 },
      hotbar: [{ type: ItemType.APPLE, count: 2 }],
      entities: { schemaVersion: 1, entities: [] },
      fixtures: { schemaVersion: 1, fixtures: [] },
      weather: { schemaVersion: 1, manualWeather: null },
    });
  });

  test('restores runtime data before publishing the normalized store state', () => {
    const runtime = createRuntime();
    const save: SaveData = {
      world: 'restored-coordinator-world',
      player: { x: 8, y: 9, z: 10 },
      hotbar: [{ type: ItemType.STONE, count: 3 }],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.CREATIVE,
      version: '0.3.0',
    };

    new GameSaveCoordinator(runtime).restore(save);

    expect(runtime.world.loadWorld).toHaveBeenCalledWith('restored-coordinator-world');
    expect(useGameStore.getState()).toMatchObject({
      hotbar: [{ type: ItemType.STONE, count: 3 }],
      activeSlot: 0,
      selectedItem: ItemType.STONE,
      gameMode: GameMode.CREATIVE,
    });
    expect(useGameStore.getState().inventory).toHaveLength(54);
  });
});
