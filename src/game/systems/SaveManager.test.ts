import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from './SaveManager';
import type { SaveData } from './SaveManager';
import { GameMode } from '@type';

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
      gameMode: GameMode.ADVENTURE
    };

    await SaveManager.saveGame('world_1', data, 'World One');
    
    const saves = await SaveManager.listSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].displayName).toBe('World One');
    expect(saves[0].id).toBe('world_1');

    const loaded = await SaveManager.getSave('world_1');
    expect(loaded).toBeDefined();
    expect(loaded?.world).toBe('dummy_world_data');
  });

  it('should delete saves', async () => {
    const data: SaveData = {
      world: 'dummy_world_data',
      player: { x: 1, y: 2, z: 3 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE
    };

    await SaveManager.saveGame('world_1', data, 'World One');
    expect((await SaveManager.listSaves()).length).toBe(1);

    await SaveManager.deleteSave('world_1');
    expect((await SaveManager.listSaves()).length).toBe(0);
    expect(await SaveManager.getSave('world_1')).toBeNull();
  });
});
