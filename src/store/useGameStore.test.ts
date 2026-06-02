import { describe, test, expect, beforeEach } from 'vitest';
import { useGameStore } from './useGameStore';
import { BLOCK_TYPES } from '@game/world/World';
import type { DebugMetrics } from '@type';

describe('useGameStore', () => {
  beforeEach(() => {
    // 重置状态
    useGameStore.setState({
      gameState: 'MENU',
      selectedBlock: BLOCK_TYPES.GRASS,
      life: 10,
      position: { x: 8.5, y: 40, z: 8.5 },
      onGround: false,
      inWater: false,
      debugOverlay: false,
      debugMetrics: null,
      isDamaged: false,
      renderDistance: 3,
      fov: 75,
    });
  });

  test('should have initial state', () => {
    const state = useGameStore.getState();
    expect(state.gameState).toBe('MENU');
    expect(state.selectedBlock).toBe(BLOCK_TYPES.GRASS);
    expect(state.life).toBe(10);
    expect(state.position).toEqual({ x: 8.5, y: 40, z: 8.5 });
    expect(state.onGround).toBe(false);
    expect(state.inWater).toBe(false);
    expect(state.debugOverlay).toBe(false);
    expect(state.debugMetrics).toBeNull();
    expect(state.isDamaged).toBe(false);
    expect(state.renderDistance).toBe(3);
    expect(state.fov).toBe(75);
  });

  test('should set game state via setGameState', () => {
    useGameStore.getState().setGameState('PLAYING');
    expect(useGameStore.getState().gameState).toBe('PLAYING');

    useGameStore.getState().setGameState('PAUSED');
    expect(useGameStore.getState().gameState).toBe('PAUSED');
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
});
