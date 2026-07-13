import { useGameStore } from '@store/useGameStore';
import {
  captureGameSaveData,
  restoreGameSaveData,
  type GameSaveRuntimePort,
} from '@game/systems/GameSaveData';
import type { SaveData } from '@game/systems/SaveManager';

/** Bridges versioned runtime snapshots with the low-frequency UI store. */
export class GameSaveCoordinator {
  private readonly runtime: GameSaveRuntimePort;

  public constructor(runtime: GameSaveRuntimePort) {
    this.runtime = runtime;
  }

  public capture(): SaveData {
    const store = useGameStore.getState();
    return captureGameSaveData(this.runtime, {
      hotbar: store.hotbar,
      inventory: store.inventory,
      activeSlot: store.activeSlot,
      gameMode: store.gameMode,
    });
  }

  public restore(save: SaveData): void {
    const restoredStore = restoreGameSaveData(this.runtime, save);
    useGameStore.setState({
      hotbar: restoredStore.hotbar,
      inventory: restoredStore.inventory,
      activeSlot: restoredStore.activeSlot,
      selectedItem: restoredStore.selectedItem,
      gameMode: restoredStore.gameMode,
    });
  }
}
