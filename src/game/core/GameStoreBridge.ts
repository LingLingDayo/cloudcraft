import type { HotbarItem } from '@type';
import { useGameStore } from '@store/useGameStore';
import type { WorldFixtureManager } from '@game/fixtures/WorldFixtureManager';

interface MutableInventoryContainer {
  inventory: (HotbarItem | null)[];
}

interface BlockEntityLookup {
  getEntity(x: number, y: number, z: number): unknown;
}

export interface GameStoreBridgeRuntime {
  debugOverlayVisible: boolean;
  readonly fixtures: Pick<WorldFixtureManager, 'setContainerSlots'>;
  readonly world: { readonly blockEntities: BlockEntityLookup };
  applyShadowQuality(quality: 'simple' | 'fancy'): void;
}

function hasMutableInventory(value: unknown): value is MutableInventoryContainer {
  return typeof value === 'object'
    && value !== null
    && 'inventory' in value
    && Array.isArray(value.inventory);
}

/** Owns the low-frequency Zustand subscription used by the game runtime. */
export class GameStoreBridge {
  private unsubscribe: (() => void) | null;

  public constructor(runtime: GameStoreBridgeRuntime) {
    const initialState = useGameStore.getState();
    let previousChestInventory = initialState.chestInventory;
    let previousDebugOverlay = initialState.debugOverlay;
    let previousShadowQuality = initialState.shadowQuality;

    runtime.debugOverlayVisible = previousDebugOverlay;
    runtime.applyShadowQuality(previousShadowQuality);

    this.unsubscribe = useGameStore.subscribe((state) => {
      if (state.chestInventory !== previousChestInventory) {
        previousChestInventory = state.chestInventory;
        if (state.activeFixtureId) {
          runtime.fixtures.setContainerSlots(state.activeFixtureId, state.chestInventory);
        } else if (state.activeChest) {
          const { x, y, z } = state.activeChest;
          const entity = runtime.world.blockEntities.getEntity(x, y, z);
          if (hasMutableInventory(entity)) {
            entity.inventory = state.chestInventory.map(item => item ? { ...item } : null);
          }
        }
      }

      if (state.debugOverlay !== previousDebugOverlay) {
        previousDebugOverlay = state.debugOverlay;
        runtime.debugOverlayVisible = state.debugOverlay;
      }

      if (state.shadowQuality !== previousShadowQuality) {
        previousShadowQuality = state.shadowQuality;
        runtime.applyShadowQuality(state.shadowQuality);
      }
    });
  }

  public dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
