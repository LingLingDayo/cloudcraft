import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { getSystemSettings, saveSystemSetting, DEFAULT_SETTINGS } from './settings';

describe('settings utility', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('should return default settings if localStorage is empty', () => {
    const settings = getSystemSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  test('should return saved settings correctly', () => {
    if (typeof localStorage !== 'undefined') {
      const saved = {
        language: 'en',
        autoJump: false,
        dpadSize: 200,
        showMinimap: false,
        playerName: 'Alex',
        renderDistance: 5,
        fov: 80,
        debugOverlay: false,
        nightBrightness: 1.5,
        shadowQuality: 'fancy',
        keybindings: { JUMP: ['KeyX'] },
      };
      localStorage.setItem('cloudcraft_settings', JSON.stringify(saved));

      const settings = getSystemSettings();
      expect(settings).toEqual(saved);
    }
  });

  test('should recover gracefully and return defaults if stored JSON is invalid', () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cloudcraft_settings', 'invalid-json-{');
      
      const settings = getSystemSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    }
  });

  test('should save setting updates and keep other fields intact', () => {
    if (typeof localStorage !== 'undefined') {
      // First save autoJump
      saveSystemSetting('autoJump', false);
      let current = getSystemSettings();
      expect(current.autoJump).toBe(false);
      expect(current.language).toBe(DEFAULT_SETTINGS.language);
      expect(current.playerName).toBe(DEFAULT_SETTINGS.playerName);

      // Then save playerName
      saveSystemSetting('playerName', 'NotSteve');
      current = getSystemSettings();
      expect(current.autoJump).toBe(false);
      expect(current.playerName).toBe('NotSteve');
      expect(current.language).toBe(DEFAULT_SETTINGS.language);
    }
  });

  test('should validate keybindings values correctly', () => {
    if (typeof localStorage !== 'undefined') {
      // Valid keybindings
      saveSystemSetting('keybindings', { JUMP: ['KeyX', 'Space'], MOVE_FORWARD: ['KeyW'] });
      let current = getSystemSettings();
      expect(current.keybindings).toEqual({ JUMP: ['KeyX', 'Space'], MOVE_FORWARD: ['KeyW'] });

      // Invalid keybindings formats (should recover to empty object)
      saveSystemSetting('keybindings', 'not-an-object' as unknown as Record<string, string[]>);
      current = getSystemSettings();
      expect(current.keybindings).toEqual({});

      // Malformed array values
      saveSystemSetting('keybindings', { JUMP: [123, 'Space'] } as unknown as Record<string, string[]>);
      current = getSystemSettings();
      expect(current.keybindings).toEqual({});
    }
  });
});
