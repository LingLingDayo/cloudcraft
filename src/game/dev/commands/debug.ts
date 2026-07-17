import type { DebugMetrics } from '@type';
import type { GameManager } from '../../core/GameManager';

export function createDebugCommands(game: GameManager) {
  return {
    getMetrics(): DebugMetrics {
      return game.getDebugMetricsSnapshot();
    }
  };
}
