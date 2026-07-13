import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from './SaveManager';
import type { SaveData } from './SaveManager';
import { GameMode, ItemType } from '@type';

describe('SaveManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return empty list initially', async () => {
    expect(await SaveManager.listSaves()).toEqual([]);
  });

  it('should save game and update metadata index', async () => {
    const data: SaveData = {
      world: 'dummy_world_data',
      player: { x: 1, y: 2, z: 3 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: SaveManager.GAME_VERSION,
      entities: {
        schemaVersion: 1,
        entities: [
          {
            id: 'pig-1',
            type: 'cloudcraft:pig',
            x: 10,
            y: 4,
            z: 10,
            vx: 0.1,
            vy: 0.2,
            vz: 0.3,
            life: 8,
            maxLife: 10,
            isPersistent: true,
            customData: { behaviorStateId: 'wandering' }
          },
          {
            id: 'leopard-1',
            type: 'cloudcraft:leopard',
            x: 16,
            y: 5,
            z: 12,
            vx: 0,
            vy: 0,
            vz: 0,
            life: 14,
            maxLife: 16,
            isPersistent: true,
            customData: { behaviorStateId: 'attacking' }
          }
        ],
      },
      fixtures: {
        schemaVersion: 1,
        fixtures: [
          {
            id: 'fixture-chest-1',
            definitionId: 'cloudcraft:chest',
            anchor: { x: 2, y: 4, z: 6 },
            orientation: 0,
            components: [{
              type: 'container',
              slots: [{ type: ItemType.APPLE, count: 2 }],
            }],
          },
        ],
      },
      weather: {
        schemaVersion: 1,
        seed: 'test-persisted-weather-seed',
        elapsedSeconds: 90,
        manualWeather: 'storm',
      },
    };

    await SaveManager.saveGame('world_1', data, 'World One');
    
    const saves = await SaveManager.listSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].displayName).toBe('World One');
    expect(saves[0].id).toBe('world_1');
    expect(saves[0].version).toBe(SaveManager.GAME_VERSION);

    const loaded = await SaveManager.getSave('world_1');
    expect(loaded).toBeDefined();
    expect(loaded?.world).toBe('dummy_world_data');
    expect(loaded?.version).toBe(SaveManager.GAME_VERSION);
    expect(loaded?.entities).toBeDefined();
    expect(Array.isArray(loaded?.entities)).toBe(false);
    if (!loaded?.entities || Array.isArray(loaded.entities)) {
      throw new Error('Expected a versioned entity snapshot');
    }
    expect(loaded.entities.entities.length).toBe(2);
    expect(loaded.entities.entities[0].id).toBe('pig-1');
    expect(loaded.entities.entities[0].type).toBe('cloudcraft:pig');
    expect(loaded.entities.entities[0].life).toBe(8);
    expect(loaded.entities.entities[1]).toMatchObject({
      id: 'leopard-1',
      type: 'cloudcraft:leopard',
      life: 14,
    });
    expect(loaded?.fixtures?.fixtures[0].id).toBe('fixture-chest-1');
    expect(loaded?.fixtures?.fixtures[0].components[0]).toEqual({
      type: 'container',
      slots: [{ type: ItemType.APPLE, count: 2 }],
    });
    expect(loaded?.weather).toEqual({
      schemaVersion: 1,
      seed: 'test-persisted-weather-seed',
      elapsedSeconds: 90,
      manualWeather: 'storm',
    });
  });

  it('should delete saves', async () => {
    const data: SaveData = {
      world: 'dummy_world_data',
      player: { x: 1, y: 2, z: 3 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE,
      version: SaveManager.GAME_VERSION
    };

    await SaveManager.saveGame('world_1', data, 'World One');
    expect((await SaveManager.listSaves()).length).toBe(1);

    await SaveManager.deleteSave('world_1');
    expect((await SaveManager.listSaves()).length).toBe(0);
    expect(await SaveManager.getSave('world_1')).toBeNull();
  });
});
