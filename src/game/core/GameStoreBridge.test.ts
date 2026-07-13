import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ItemType } from '@type';
import { useGameStore } from '@store/useGameStore';
import {
  GameStoreBridge,
  type GameStoreBridgeRuntime,
} from './GameStoreBridge';

function createRuntime(): GameStoreBridgeRuntime {
  return {
    debugOverlayVisible: false,
    fixtures: { setContainerSlots: vi.fn(() => true) },
    world: { blockEntities: { getEntity: vi.fn(() => null) } },
    applyShadowQuality: vi.fn(),
  };
}

describe('GameStoreBridge', () => {
  beforeEach(() => {
    useGameStore.setState({
      activeFixtureId: null,
      activeChest: null,
      chestInventory: [],
      debugOverlay: false,
      shadowQuality: 'simple',
    });
  });

  test('writes active fixture inventory changes and stops after disposal', () => {
    const runtime = createRuntime();
    useGameStore.setState({ activeFixtureId: 'fixture-chest' });
    const bridge = new GameStoreBridge(runtime);

    useGameStore.setState({
      chestInventory: [{ type: ItemType.APPLE, count: 2 }],
    });
    expect(runtime.fixtures.setContainerSlots).toHaveBeenCalledWith(
      'fixture-chest',
      [{ type: ItemType.APPLE, count: 2 }],
    );

    bridge.dispose();
    useGameStore.setState({ chestInventory: [] });
    expect(runtime.fixtures.setContainerSlots).toHaveBeenCalledOnce();
  });

  test('clones inventory stacks when synchronizing a legacy block container', () => {
    const entity: {
      inventory: Array<{ type: typeof ItemType.APPLE; count: number } | null>;
    } = { inventory: [] };
    const runtime = createRuntime();
    runtime.world.blockEntities.getEntity = vi.fn(() => entity);
    useGameStore.setState({ activeChest: { x: 1, y: 2, z: 3 } });
    const bridge = new GameStoreBridge(runtime);
    const stack = { type: ItemType.APPLE, count: 1 };

    useGameStore.setState({ chestInventory: [stack] });

    expect(entity.inventory).toEqual([stack]);
    expect(entity.inventory[0]).not.toBe(stack);
    bridge.dispose();
  });
});
