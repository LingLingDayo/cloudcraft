import type { GameManager } from '../core/GameManager';
import { createDevConsole } from './DevConsole';
import type { CloudcraftDevConsole } from './DevConsole';

declare global {
  interface Window {
    __cloudcraft__?: CloudcraftDevConsole;
  }
}

/**
 * Mounts the DevConsole to window.__cloudcraft__ in DEV environment.
 * In production environment, this is a no-op to allow tree shaking.
 */
export function mountDevConsole(game: GameManager): void {
  if (import.meta.env.DEV) {
    try {
      window.__cloudcraft__ = createDevConsole(game);
      console.log(
        '%c[CloudCraft DevConsole] Loaded successfully. Type `window.__cloudcraft__.meta.help()` to see available commands.',
        'color: #4caf50; font-weight: bold;'
      );
    } catch (err) {
      console.error('Failed to mount CloudCraft DevConsole:', err);
    }
  }
}
