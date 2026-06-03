import { GameMode } from '@type';

export interface SaveMetadata {
  id: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
  gameMode: string;
  seed: string;
}

export interface SaveData {
  world: string;
  player: { x: number; y: number; z: number };
  hotbar: any[];
  inventory: any[];
  activeSlot: number;
  gameMode: GameMode;
}

export class SaveManager {
  private static INDEX_KEY = 'minicraft_saves_index';
  private static SAVE_PREFIX = 'minicraft_save_';

  public static listSaves(): SaveMetadata[] {
    const raw = localStorage.getItem(this.INDEX_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static getSave(id: string): SaveData | null {
    const raw = localStorage.getItem(`${this.SAVE_PREFIX}${id}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static saveGame(id: string, data: Omit<SaveData, 'createdAt'>, displayName?: string): void {
    const now = Date.now();
    
    // Save the actual data
    localStorage.setItem(`${this.SAVE_PREFIX}${id}`, JSON.stringify(data));

    // Update metadata index
    const index = this.listSaves();
    const existingIdx = index.findIndex(meta => meta.id === id);
    if (existingIdx !== -1) {
      index[existingIdx] = {
        ...index[existingIdx],
        updatedAt: now,
        gameMode: data.gameMode,
      };
    } else {
      index.push({
        id,
        displayName: displayName || id,
        createdAt: now,
        updatedAt: now,
        gameMode: data.gameMode,
        seed: 'minicraft', // Placeholder, default seed
      });
    }
    localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
  }

  public static deleteSave(id: string): void {
    localStorage.removeItem(`${this.SAVE_PREFIX}${id}`);
    const index = this.listSaves();
    const updated = index.filter(meta => meta.id !== id);
    localStorage.setItem(this.INDEX_KEY, JSON.stringify(updated));
  }
}
