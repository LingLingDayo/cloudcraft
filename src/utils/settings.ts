import type { Language } from '@type';

export interface SystemSettings {
  language: Language;
  autoJump: boolean;
  dpadSize: number;
  showMinimap: boolean;
  playerName: string;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  language: 'zh',
  autoJump: true,
  dpadSize: 180,
  showMinimap: true,
  playerName: 'Steve',
};

const SETTINGS_KEY = 'minicraft_settings';

export function getSystemSettings(): SystemSettings {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      language: parsed.language || DEFAULT_SETTINGS.language,
      autoJump: parsed.autoJump !== undefined ? parsed.autoJump : DEFAULT_SETTINGS.autoJump,
      dpadSize: parsed.dpadSize !== undefined ? Number(parsed.dpadSize) : DEFAULT_SETTINGS.dpadSize,
      showMinimap: parsed.showMinimap !== undefined ? parsed.showMinimap : DEFAULT_SETTINGS.showMinimap,
      playerName: parsed.playerName || DEFAULT_SETTINGS.playerName,
    };
  } catch {
    console.warn('Failed to parse system settings from localStorage');
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSystemSetting<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const current = getSystemSettings();
    current[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch {
    console.warn(`Failed to save system setting ${key} to localStorage`);
  }
}
