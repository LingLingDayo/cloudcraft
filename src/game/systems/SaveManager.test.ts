import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from './SaveManager';
import type { SaveData } from './SaveManager';
import { GameMode } from '@type';

describe('SaveManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return empty list initially', () => {
    expect(SaveManager.listSaves()).toEqual([]);
  });

  it('should save game and update metadata index', () => {
    const data: SaveData = {
      world: 'dummy_world_data',
      player: { x: 1, y: 2, z: 3 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE
    };

    SaveManager.saveGame('world_1', data, 'World One');
    
    const saves = SaveManager.listSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].displayName).toBe('World One');
    expect(saves[0].id).toBe('world_1');

    const loaded = SaveManager.getSave('world_1');
    expect(loaded).toBeDefined();
    expect(loaded?.world).toBe('dummy_world_data');
  });

  it('should delete saves', () => {
    const data: SaveData = {
      world: 'dummy_world_data',
      player: { x: 1, y: 2, z: 3 },
      hotbar: [],
      inventory: [],
      activeSlot: 0,
      gameMode: GameMode.ADVENTURE
    };

    SaveManager.saveGame('world_1', data, 'World One');
    expect(SaveManager.listSaves().length).toBe(1);

    SaveManager.deleteSave('world_1');
    expect(SaveManager.listSaves().length).toBe(0);
    expect(SaveManager.getSave('world_1')).toBeNull();
  });
});
