import { describe, test, expect, beforeEach } from 'vitest';
import { useGameStore } from './useGameStore';
import { BLOCK_TYPES } from '@game/world/World';
import { GameState, GameMode, type DebugMetrics } from '@type';

describe('useGameStore', () => {
  beforeEach(() => {
    // 重置状态
    useGameStore.setState({
      gameState: GameState.MENU,
      selectedBlock: BLOCK_TYPES.AIR,
      activeSlot: 0,
      hotbar: Array(9).fill(null),
      life: 10,
      position: { x: 8.5, y: 40, z: 8.5 },
      onGround: false,
      inWater: false,
      debugOverlay: false,
      debugMetrics: null,
      isDamaged: false,
      renderDistance: 3,
      fov: 75,
      gameMode: GameMode.ADVENTURE,
      isInventoryOpen: false,
      inventory: Array(54).fill(null),
      language: 'zh',
    });
  });

  test('should have initial state', () => {
    const state = useGameStore.getState();
    expect(state.gameState).toBe(GameState.MENU);
    expect(state.selectedBlock).toBe(BLOCK_TYPES.AIR);
    expect(state.activeSlot).toBe(0);
    expect(state.hotbar).toEqual(Array(9).fill(null));
    expect(state.life).toBe(10);
    expect(state.position).toEqual({ x: 8.5, y: 40, z: 8.5 });
    expect(state.onGround).toBe(false);
    expect(state.inWater).toBe(false);
    expect(state.debugOverlay).toBe(false);
    expect(state.debugMetrics).toBeNull();
    expect(state.isDamaged).toBe(false);
    expect(state.renderDistance).toBe(3);
    expect(state.fov).toBe(75);
    expect(state.gameMode).toBe(GameMode.ADVENTURE);
    expect(state.isInventoryOpen).toBe(false);
    expect(state.inventory).toEqual(Array(54).fill(null));
    expect(state.language).toBe('zh');
  });

  test('should set game state via setGameState', () => {
    useGameStore.getState().setGameState(GameState.PLAYING);
    expect(useGameStore.getState().gameState).toBe(GameState.PLAYING);

    useGameStore.getState().setGameState(GameState.PAUSED);
    expect(useGameStore.getState().gameState).toBe(GameState.PAUSED);
  });

  test('should set game mode via setGameMode and auto reset hotbar', () => {
    useGameStore.getState().setGameMode(GameMode.CREATIVE);
    expect(useGameStore.getState().gameMode).toBe(GameMode.CREATIVE);
    expect(useGameStore.getState().hotbar[0]).toEqual({ type: BLOCK_TYPES.GRASS, count: 1 });
    expect(useGameStore.getState().selectedBlock).toBe(BLOCK_TYPES.GRASS);

    useGameStore.getState().setGameMode(GameMode.ADVENTURE);
    expect(useGameStore.getState().gameMode).toBe(GameMode.ADVENTURE);
    expect(useGameStore.getState().hotbar[0]).toBeNull();
    expect(useGameStore.getState().selectedBlock).toBe(BLOCK_TYPES.AIR);
  });

  test('should set active slot and update selected block', () => {
    useGameStore.setState({
      hotbar: [
        null,
        { type: BLOCK_TYPES.DIRT, count: 5 },
        null, null, null, null, null, null, null
      ]
    });
    
    useGameStore.getState().setActiveSlot(1);
    expect(useGameStore.getState().activeSlot).toBe(1);
    expect(useGameStore.getState().selectedBlock).toBe(BLOCK_TYPES.DIRT);

    useGameStore.getState().setActiveSlot(0);
    expect(useGameStore.getState().activeSlot).toBe(0);
    expect(useGameStore.getState().selectedBlock).toBe(BLOCK_TYPES.AIR);
  });

  test('should add items to hotbar in adventure mode', () => {
    const success = useGameStore.getState().addToHotbar(BLOCK_TYPES.STONE, 3);
    expect(success).toBe(true);
    expect(useGameStore.getState().hotbar[0]).toEqual({ type: BLOCK_TYPES.STONE, count: 3 });

    const success2 = useGameStore.getState().addToHotbar(BLOCK_TYPES.STONE, 2);
    expect(success2).toBe(true);
    expect(useGameStore.getState().hotbar[0]).toEqual({ type: BLOCK_TYPES.STONE, count: 5 });

    expect(useGameStore.getState().selectedBlock).toBe(BLOCK_TYPES.STONE);
  });

  test('should decrement hotbar item and clear slot', () => {
    useGameStore.setState({
      hotbar: [
        { type: BLOCK_TYPES.WOOD, count: 2 },
        null, null, null, null, null, null, null, null
      ],
      selectedBlock: BLOCK_TYPES.WOOD
    });

    useGameStore.getState().decrementHotbarItem(0);
    expect(useGameStore.getState().hotbar[0]).toEqual({ type: BLOCK_TYPES.WOOD, count: 1 });
    expect(useGameStore.getState().selectedBlock).toBe(BLOCK_TYPES.WOOD);

    useGameStore.getState().decrementHotbarItem(0);
    expect(useGameStore.getState().hotbar[0]).toBeNull();
    expect(useGameStore.getState().selectedBlock).toBe(BLOCK_TYPES.AIR);
  });

  test('should set selected block via setSelectedBlock', () => {
    useGameStore.getState().setSelectedBlock(BLOCK_TYPES.DIRT);
    expect(useGameStore.getState().selectedBlock).toBe(BLOCK_TYPES.DIRT);
  });

  test('should set life via setLife', () => {
    useGameStore.getState().setLife(8);
    expect(useGameStore.getState().life).toBe(8);
  });

  test('should set player state via setPlayerState', () => {
    const position = { x: 12, y: 45.5, z: -3.2 };
    
    // Test without updating life
    useGameStore.getState().setPlayerState(position, true, false);
    let state = useGameStore.getState();
    expect(state.position).toEqual(position);
    expect(state.onGround).toBe(true);
    expect(state.inWater).toBe(false);
    expect(state.life).toBe(10); // Remains unchanged

    // Test with updating life
    useGameStore.getState().setPlayerState(position, false, true, 5);
    state = useGameStore.getState();
    expect(state.onGround).toBe(false);
    expect(state.inWater).toBe(true);
    expect(state.life).toBe(5);
  });

  test('should set debug overlay visibility via setDebugOverlay', () => {
    useGameStore.getState().setDebugOverlay(true);
    expect(useGameStore.getState().debugOverlay).toBe(true);
  });

  test('should set debug metrics via setDebugMetrics', () => {
    const metrics: DebugMetrics = {
      fps: 60,
      chunksLoaded: 9,
      isFlying: false,
      targetBlock: null,
    };
    useGameStore.getState().setDebugMetrics(metrics);
    expect(useGameStore.getState().debugMetrics).toEqual(metrics);
  });

  test('should set damage flag via setIsDamaged', () => {
    useGameStore.getState().setIsDamaged(true);
    expect(useGameStore.getState().isDamaged).toBe(true);
  });

  test('should set render distance via setRenderDistance', () => {
    useGameStore.getState().setRenderDistance(5);
    expect(useGameStore.getState().renderDistance).toBe(5);
  });

  test('should set fov via setFov', () => {
    useGameStore.getState().setFov(85);
    expect(useGameStore.getState().fov).toBe(85);
  });

  test('should handle inventory operations', () => {
    const store = useGameStore.getState();
    expect(store.isInventoryOpen).toBe(false);

    store.openInventory();
    expect(useGameStore.getState().isInventoryOpen).toBe(true);

    useGameStore.getState().closeInventory();
    expect(useGameStore.getState().isInventoryOpen).toBe(false);

    useGameStore.getState().toggleInventory();
    expect(useGameStore.getState().isInventoryOpen).toBe(true);

    useGameStore.getState().toggleInventory();
    expect(useGameStore.getState().isInventoryOpen).toBe(false);

    const testInv = Array(54).fill(null);
    testInv[0] = { type: BLOCK_TYPES.STONE, count: 64 };
    useGameStore.getState().setInventory(testInv);
    expect(useGameStore.getState().inventory[0]).toEqual({ type: BLOCK_TYPES.STONE, count: 64 });
  });

  test('should add items to inventory if hotbar is full in adventure mode', () => {
    // Fill hotbar
    useGameStore.setState({
      hotbar: Array(9).fill({ type: BLOCK_TYPES.DIRT, count: 64 }),
    });

    const success = useGameStore.getState().addToHotbar(BLOCK_TYPES.STONE, 10);
    expect(success).toBe(true);
    // Should be in inventory
    expect(useGameStore.getState().inventory[0]).toEqual({ type: BLOCK_TYPES.STONE, count: 10 });
  });

  test('should set language via setLanguage', () => {
    useGameStore.getState().setLanguage('en');
    expect(useGameStore.getState().language).toBe('en');

    useGameStore.getState().setLanguage('zh');
    expect(useGameStore.getState().language).toBe('zh');
  });
});
