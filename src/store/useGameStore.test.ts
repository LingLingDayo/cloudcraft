import { describe, test, expect, beforeEach } from 'vitest';
import { useGameStore } from './useGameStore';
import { GameState, GameMode, type DebugMetrics, ItemType } from '@type';

describe('useGameStore', () => {
  beforeEach(() => {
    // 重置状态
    useGameStore.setState({
      gameState: GameState.MENU,
      selectedItem: null,
      activeSlot: 0,
      hotbar: Array(9).fill(null),
      life: 10,
      hunger: 20,
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
      autoJump: true,
      dpadSize: 180,
      isWorldLoading: false,
      worldLoadingProgress: 0,
      worldLoadingStage: 'engine',
      chunkLoadingStates: {},
      showMinimap: true,
    });
  });

  test('should have initial state', () => {
    const state = useGameStore.getState();
    expect(state.gameState).toBe(GameState.MENU);
    expect(state.selectedItem).toBeNull();
    expect(state.activeSlot).toBe(0);
    expect(state.hotbar).toEqual(Array(9).fill(null));
    expect(state.life).toBe(10);
    expect(state.hunger).toBe(20);
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
    expect(state.autoJump).toBe(true);
    expect(state.dpadSize).toBe(180);
    expect(state.isWorldLoading).toBe(false);
    expect(state.worldLoadingProgress).toBe(0);
    expect(state.worldLoadingStage).toBe('engine');
    expect(state.chunkLoadingStates).toEqual({});
    expect(state.showMinimap).toBe(true);
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
    expect(useGameStore.getState().hotbar[0]).toEqual({ type: ItemType.GRASS, count: 1 });
    expect(useGameStore.getState().selectedItem).toBe(ItemType.GRASS);

    useGameStore.getState().setGameMode(GameMode.ADVENTURE);
    expect(useGameStore.getState().gameMode).toBe(GameMode.ADVENTURE);
    expect(useGameStore.getState().hotbar[0]).toBeNull();
    expect(useGameStore.getState().selectedItem).toBeNull();
  });

  test('should set active slot and update selected item', () => {
    useGameStore.setState({
      hotbar: [
        null,
        { type: ItemType.DIRT, count: 5 },
        null, null, null, null, null, null, null
      ]
    });
    
    useGameStore.getState().setActiveSlot(1);
    expect(useGameStore.getState().activeSlot).toBe(1);
    expect(useGameStore.getState().selectedItem).toBe(ItemType.DIRT);

    useGameStore.getState().setActiveSlot(0);
    expect(useGameStore.getState().activeSlot).toBe(0);
    expect(useGameStore.getState().selectedItem).toBeNull();
  });

  test('should add items to hotbar in adventure mode', () => {
    const success = useGameStore.getState().addToHotbar(ItemType.STONE, 3);
    expect(success).toBe(true);
    expect(useGameStore.getState().hotbar[0]).toEqual({ type: ItemType.STONE, count: 3 });

    const success2 = useGameStore.getState().addToHotbar(ItemType.STONE, 2);
    expect(success2).toBe(true);
    expect(useGameStore.getState().hotbar[0]).toEqual({ type: ItemType.STONE, count: 5 });

    // Active slot 0 now has STONE
    expect(useGameStore.getState().selectedItem).toBe(ItemType.STONE);
  });

  test('should decrement hotbar item and clear slot', () => {
    useGameStore.setState({
      hotbar: [
        { type: ItemType.WOOD, count: 2 },
        null, null, null, null, null, null, null, null
      ],
      selectedItem: ItemType.WOOD
    });

    useGameStore.getState().decrementHotbarItem(0);
    expect(useGameStore.getState().hotbar[0]).toEqual({ type: ItemType.WOOD, count: 1 });
    expect(useGameStore.getState().selectedItem).toBe(ItemType.WOOD);

    useGameStore.getState().decrementHotbarItem(0);
    expect(useGameStore.getState().hotbar[0]).toBeNull();
    expect(useGameStore.getState().selectedItem).toBeNull();
  });

  test('should set selected item via setSelectedItem', () => {
    useGameStore.getState().setSelectedItem(ItemType.DIRT);
    expect(useGameStore.getState().selectedItem).toBe(ItemType.DIRT);
  });

  test('should set life via setLife', () => {
    useGameStore.getState().setLife(8);
    expect(useGameStore.getState().life).toBe(8);
  });

  test('should set player state via setPlayerState', () => {
    const position = { x: 12, y: 45.5, z: -3.2 };
    
    // Test without updating life/hunger
    useGameStore.getState().setPlayerState(position, true, false);
    let state = useGameStore.getState();
    expect(state.position).toEqual(position);
    expect(state.onGround).toBe(true);
    expect(state.inWater).toBe(false);
    expect(state.life).toBe(10); // Remains unchanged
    expect(state.hunger).toBe(20); // Remains unchanged

    // Test with updating life and hunger
    useGameStore.getState().setPlayerState(position, false, true, 5, 15);
    state = useGameStore.getState();
    expect(state.onGround).toBe(false);
    expect(state.inWater).toBe(true);
    expect(state.life).toBe(5);
    expect(state.hunger).toBe(15);
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
    testInv[0] = { type: ItemType.STONE, count: 64 };
    useGameStore.getState().setInventory(testInv);
    expect(useGameStore.getState().inventory[0]).toEqual({ type: ItemType.STONE, count: 64 });
  });

  test('should add items to inventory if hotbar is full in adventure mode', () => {
    // Fill hotbar
    useGameStore.setState({
      hotbar: Array(9).fill({ type: ItemType.DIRT, count: 64 }),
    });

    const success = useGameStore.getState().addToHotbar(ItemType.STONE, 10);
    expect(success).toBe(true);
    // Should be in inventory
    expect(useGameStore.getState().inventory[0]).toEqual({ type: ItemType.STONE, count: 10 });
  });

  test('should set language via setLanguage', () => {
    useGameStore.getState().setLanguage('en');
    expect(useGameStore.getState().language).toBe('en');

    useGameStore.getState().setLanguage('zh');
    expect(useGameStore.getState().language).toBe('zh');
  });

  test('should set auto jump via setAutoJump', () => {
    useGameStore.getState().setAutoJump(false);
    expect(useGameStore.getState().autoJump).toBe(false);

    useGameStore.getState().setAutoJump(true);
    expect(useGameStore.getState().autoJump).toBe(true);
  });

  test('should set dpad size via setDpadSize', () => {
    useGameStore.getState().setDpadSize(200);
    expect(useGameStore.getState().dpadSize).toBe(200);

    useGameStore.getState().setDpadSize(150);
    expect(useGameStore.getState().dpadSize).toBe(150);
  });

  test('should handle loading states and progress correctly', () => {
    const store = useGameStore.getState();
    expect(store.isWorldLoading).toBe(false);

    store.setWorldLoading(true);
    expect(useGameStore.getState().isWorldLoading).toBe(true);

    store.setWorldLoadingStage('chunks');
    expect(useGameStore.getState().worldLoadingStage).toBe('chunks');

    store.setWorldLoadingProgress(10);
    expect(useGameStore.getState().worldLoadingProgress).toBe(10);

    // Initialize chunks loading
    store.initChunkLoading(['1,1', '1,2', '2,1', '2,2']);
    expect(useGameStore.getState().worldLoadingProgress).toBe(30); // Starts at 30% for chunks stage
    expect(useGameStore.getState().chunkLoadingStates).toEqual({
      '1,1': false,
      '1,2': false,
      '2,1': false,
      '2,2': false,
    });

    // Load one chunk (1 out of 4 is 25% progress of chunks stage: 30 + 0.25 * 70 = 48% approximately)
    store.setChunkLoadingState('1,1', true);
    expect(useGameStore.getState().chunkLoadingStates['1,1']).toBe(true);
    expect(useGameStore.getState().worldLoadingProgress).toBe(Math.round(30 + 0.25 * 70)); // 48%

    // Load all chunks
    store.setChunkLoadingState('1,2', true);
    store.setChunkLoadingState('2,1', true);
    store.setChunkLoadingState('2,2', true);
    expect(useGameStore.getState().worldLoadingProgress).toBe(100);
  });

  test('should set show minimap via setShowMinimap', () => {
    useGameStore.getState().setShowMinimap(false);
    expect(useGameStore.getState().showMinimap).toBe(false);

    useGameStore.getState().setShowMinimap(true);
    expect(useGameStore.getState().showMinimap).toBe(true);
  });
});
