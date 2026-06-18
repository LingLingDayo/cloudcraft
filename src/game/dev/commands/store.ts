import { useGameStore } from '@store/useGameStore';
import { ItemType } from '@type';
import type { GameManager } from '../../core/GameManager';

export function createStoreCommands(_game: GameManager) {
  return {
    get() {
      return useGameStore.getState();
    },
    setGameMode(mode: 'adventure' | 'creative') {
      if (mode !== 'adventure' && mode !== 'creative') {
        console.error("Invalid game mode. Valid options are: 'adventure' | 'creative'");
        return;
      }
      useGameStore.getState().setGameMode(mode);
      console.log(`Set game mode to: ${mode}`);
    },
    giveItem(itemType: string, count: number = 1) {
      const validItemTypes = Object.values(ItemType) as string[];
      if (!validItemTypes.includes(itemType)) {
        console.error(`Invalid itemType: ${itemType}. Valid options are: ${validItemTypes.join(', ')}`);
        return false;
      }
      const success = useGameStore.getState().addToHotbar(itemType as ItemType, count);
      console.log(`Give item ${itemType} (count: ${count}): ${success ? 'SUCCESS' : 'FAILED'}`);
      return success;
    }
  };
}
