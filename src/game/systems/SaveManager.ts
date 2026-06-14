import { GameMode, type HotbarItem, type Vector3D } from '@type';
import pkg from '@package';

export interface SaveMetadata {
  id: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
  gameMode: string;
  seed: string;
  version: string;
}

export interface SaveData {
  world: string;
  player: Vector3D;
  hotbar: (HotbarItem | null)[];
  inventory: (HotbarItem | null)[];
  activeSlot: number;
  gameMode: GameMode;
  version: string;
  seed?: string;
}

export class SaveManager {
  public static GAME_VERSION = pkg.version;
  private static INDEX_KEY = 'cloudcraft_saves_index';
  private static SAVE_PREFIX = 'cloudcraft_save_';

  // Detect environment support for IndexedDB (fallback to localStorage in Vitest Node environment)
  private static useLocalStorage = typeof indexedDB === 'undefined';

  private static getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('cloudcraft_db', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('saves')) {
          db.createObjectStore('saves');
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
      };
    });
  }

  public static async listSaves(): Promise<SaveMetadata[]> {
    if (this.useLocalStorage) {
      const raw = localStorage.getItem(this.INDEX_KEY);
      if (!raw) return [];
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('metadata', 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  public static async getSave(id: string): Promise<SaveData | null> {
    if (this.useLocalStorage) {
      const raw = localStorage.getItem(`${this.SAVE_PREFIX}${id}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('saves', 'readonly');
      const store = transaction.objectStore('saves');
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  public static async saveGame(id: string, data: Omit<SaveData, 'createdAt'>, displayName?: string): Promise<void> {
    const now = Date.now();
    const saveSeed = data.seed || 'cloudcraft';

    if (this.useLocalStorage) {
      localStorage.setItem(`${this.SAVE_PREFIX}${id}`, JSON.stringify(data));
      const index = await this.listSaves();
      const existingIdx = index.findIndex(meta => meta.id === id);
      if (existingIdx !== -1) {
        index[existingIdx] = {
          ...index[existingIdx],
          updatedAt: now,
          gameMode: data.gameMode,
          version: data.version,
          seed: saveSeed,
        };
      } else {
        index.push({
          id,
          displayName: displayName || id,
          createdAt: now,
          updatedAt: now,
          gameMode: data.gameMode,
          seed: saveSeed,
          version: data.version,
        });
      }
      localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
      return;
    }

    const db = await this.getDB();

    // 1. Fetch metadata or initialize new
    const metadata: SaveMetadata = await new Promise((resolve, reject) => {
      const transaction = db.transaction('metadata', 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    }) || {
      id,
      displayName: displayName || id,
      createdAt: now,
      updatedAt: now,
      gameMode: data.gameMode,
      seed: saveSeed,
      version: data.version,
    };

    metadata.updatedAt = now;
    metadata.gameMode = data.gameMode;
    metadata.version = data.version;
    metadata.seed = saveSeed;
    if (displayName) {
      metadata.displayName = displayName;
    }

    // 2. Put records atomically
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['saves', 'metadata'], 'readwrite');
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      const savesStore = transaction.objectStore('saves');
      const metadataStore = transaction.objectStore('metadata');

      savesStore.put(data, id);
      metadataStore.put(metadata, id);
    });
  }

  public static async deleteSave(id: string): Promise<void> {
    if (this.useLocalStorage) {
      localStorage.removeItem(`${this.SAVE_PREFIX}${id}`);
      const index = await this.listSaves();
      const updated = index.filter(meta => meta.id !== id);
      localStorage.setItem(this.INDEX_KEY, JSON.stringify(updated));
      return;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['saves', 'metadata'], 'readwrite');
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      const savesStore = transaction.objectStore('saves');
      const metadataStore = transaction.objectStore('metadata');

      savesStore.delete(id);
      metadataStore.delete(id);
    });
  }
}
