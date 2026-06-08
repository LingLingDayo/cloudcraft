import type { Language } from '@type';

export interface SystemSettings {
  language: Language;
  autoJump: boolean;
  dpadSize: number;
  showMinimap: boolean;
  playerName: string;
  renderDistance: number;
  fov: number;
  enableDistanceLOD: boolean;
  lodStrength: number;
  debugOverlay: boolean;
}

export interface SettingDefinition<T> {
  defaultValue: T;
  validate: (val: unknown) => T;
}

export const SETTINGS_REGISTRY: { [K in keyof SystemSettings]: SettingDefinition<SystemSettings[K]> } = {
  language: {
    defaultValue: 'zh',
    validate: (val) => (val === 'zh' || val === 'en' ? val : 'zh'),
  },
  playerName: {
    defaultValue: 'Steve',
    validate: (val) => (typeof val === 'string' && val.trim() ? val.substring(0, 16) : 'Steve'),
  },
  autoJump: {
    defaultValue: true,
    validate: (val) => (typeof val === 'boolean' ? val : true),
  },
  showMinimap: {
    defaultValue: true,
    validate: (val) => (typeof val === 'boolean' ? val : true),
  },
  dpadSize: {
    defaultValue: 180,
    validate: (val) => {
      const num = Number(val);
      return !isNaN(num) ? Math.max(120, Math.min(240, num)) : 180;
    },
  },
  renderDistance: {
    defaultValue: 4,
    validate: (val) => {
      const num = Number(val);
      return !isNaN(num) ? Math.max(2, Math.min(10, num)) : 4;
    },
  },
  fov: {
    defaultValue: 75,
    validate: (val) => {
      const num = Number(val);
      return !isNaN(num) ? Math.max(60, Math.min(90, num)) : 75;
    },
  },
  enableDistanceLOD: {
    defaultValue: true,
    validate: (val) => (typeof val === 'boolean' ? val : true),
  },
  lodStrength: {
    defaultValue: 3,
    validate: (val) => {
      const num = Number(val);
      return !isNaN(num) ? Math.max(1, Math.min(5, num)) : 3;
    },
  },
  debugOverlay: {
    defaultValue: false,
    validate: (val) => (typeof val === 'boolean' ? val : false),
  },
};

const SETTINGS_KEY = 'webcraft_settings';

export class SettingsManager {
  public static load(): SystemSettings {
    if (typeof localStorage === 'undefined') {
      return this.getDefaults();
    }
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return this.getDefaults();
      }
      const parsed = JSON.parse(raw);
      const loaded = {} as Record<string, unknown>;
      for (const key in SETTINGS_REGISTRY) {
        const k = key as keyof SystemSettings;
        loaded[k] = SETTINGS_REGISTRY[k].validate(parsed[k]);
      }
      return loaded as unknown as SystemSettings;
    } catch {
      console.warn('Failed to parse system settings from localStorage');
      return this.getDefaults();
    }
  }

  public static save<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const current = this.load() as unknown as Record<string, unknown>;
      current[key] = SETTINGS_REGISTRY[key].validate(value);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
    } catch {
      console.warn(`Failed to save system setting ${key} to localStorage`);
    }
  }

  public static getDefaults(): SystemSettings {
    const defaults = {} as Record<string, unknown>;
    for (const key in SETTINGS_REGISTRY) {
      const k = key as keyof SystemSettings;
      defaults[k] = SETTINGS_REGISTRY[k].defaultValue;
    }
    return defaults as unknown as SystemSettings;
  }
}

// Backward compatible wrappers
export const DEFAULT_SETTINGS: SystemSettings = SettingsManager.getDefaults();

export function getSystemSettings(): SystemSettings {
  return SettingsManager.load();
}

export function saveSystemSetting<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]): void {
  SettingsManager.save(key, value);
}
