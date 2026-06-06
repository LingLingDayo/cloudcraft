import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Player } from './Player';
import { useGameStore } from '@store/useGameStore';
import { BLOCK_TYPES } from '@game/world/World';
import type { Physics } from '@game/physics/Physics';
import type { Controls } from '@game/systems/Controls';
import type { World } from '@game/world/World';

// Mock Sound
vi.mock('@game/systems/Sound', () => {
  return {
    sound: {
      playClick: vi.fn(),
      playJump: vi.fn(),
      playDamage: vi.fn(),
      playBreak: vi.fn(),
    },
  };
});

describe('Player', () => {
  let camera: THREE.PerspectiveCamera;
  let player: Player;
  let mockPhysics: Physics;
  let mockControls: Controls;
  let mockWorld: World;
  let mockIsActionPressed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    player = new Player(camera);

    mockPhysics = {
      update: vi.fn(),
      isSolid: vi.fn(() => false),
    } as unknown as Physics;

    mockIsActionPressed = vi.fn(() => false);

    mockControls = {
      getMovementDirection: vi.fn(() => new THREE.Vector3()),
      isActionPressed: mockIsActionPressed,
    } as unknown as Controls;

    mockWorld = {
      getBlock: vi.fn(() => BLOCK_TYPES.AIR),
    } as unknown as World;

    // Reset Zustand store
    useGameStore.setState({
      gameMode: 'adventure',
    });
  });

  test('should initialize with isFlying = false', () => {
    expect(player.isFlying).toBe(false);
  });

  test('should initialize hunger to 20', () => {
    expect(player.hunger).toBe(20);
  });

  test('should decrease hunger when updating player in adventure mode with movement', () => {
    useGameStore.setState({ gameMode: 'adventure' });
    player.hunger = 20;
    player.state.onGround = true;

    // Simulate movement
    const spyDirection = vi.spyOn(mockControls, 'getMovementDirection');
    spyDirection.mockImplementation(() => new THREE.Vector3(1, 0, 0));

    // Simulate sprinting (Shift key is pressed)
    mockIsActionPressed.mockReturnValue(true);

    // Update player to trigger exhaustion over time (sprinting on ground)
    for (let i = 0; i < 300; i++) {
      player.update(0.1, mockPhysics, mockControls, mockWorld);
    }

    expect(player.hunger).toBeLessThan(20);
    spyDirection.mockRestore();
  });

  test('should reset isFlying if gameMode changes to adventure', () => {
    player.isFlying = true;
    useGameStore.setState({ gameMode: 'adventure' });
    player.update(0.1, mockPhysics, mockControls, mockWorld);
    expect(player.isFlying).toBe(false);
  });

  test('should double-click Space key in creative mode to toggle flying', () => {
    useGameStore.setState({ gameMode: 'creative' });
    
    // Setup time tracking simulation
    let time = 1000; // in ms
    const spyPerformance = vi.spyOn(performance, 'now');
    spyPerformance.mockImplementation(() => time);

    // Frame 1: Space not pressed
    mockIsActionPressed.mockReturnValue(false);
    player.update(0.05, mockPhysics, mockControls, mockWorld);
    expect(player.isFlying).toBe(false);

    // Frame 2: Space pressed (First press)
    mockIsActionPressed.mockReturnValue(true);
    player.update(0.05, mockPhysics, mockControls, mockWorld);
    expect(player.isFlying).toBe(false);

    // Frame 3: Space released
    time += 100; // 100ms later
    mockIsActionPressed.mockReturnValue(false);
    player.update(0.05, mockPhysics, mockControls, mockWorld);
    expect(player.isFlying).toBe(false);

    // Frame 4: Space pressed again (Second press within 250ms delay)
    time += 100; // 200ms total elapsed from first press
    mockIsActionPressed.mockReturnValue(true);
    player.update(0.05, mockPhysics, mockControls, mockWorld);
    
    // Should be flying now!
    expect(player.isFlying).toBe(true);

    // Frame 5: Space released
    time += 100;
    mockIsActionPressed.mockReturnValue(false);
    player.update(0.05, mockPhysics, mockControls, mockWorld);
    expect(player.isFlying).toBe(true);

    // Frame 6: Space pressed again (First press of second double-click sequence)
    time += 100;
    mockIsActionPressed.mockReturnValue(true);
    player.update(0.05, mockPhysics, mockControls, mockWorld);
    expect(player.isFlying).toBe(true); // Still flying

    // Frame 7: Space released
    time += 100;
    mockIsActionPressed.mockReturnValue(false);
    player.update(0.05, mockPhysics, mockControls, mockWorld);
    expect(player.isFlying).toBe(true);

    // Frame 8: Space pressed (Second press of second double-click sequence within 250ms)
    time += 100;
    mockIsActionPressed.mockReturnValue(true);
    player.update(0.05, mockPhysics, mockControls, mockWorld);
    
    // Should toggle back to not flying
    expect(player.isFlying).toBe(false);

    spyPerformance.mockRestore();
  });

  test('should not toggle flying if double-click spacing exceeds doubleJumpDelay', () => {
    useGameStore.setState({ gameMode: 'creative' });
    
    let time = 1000;
    const spyPerformance = vi.spyOn(performance, 'now');
    spyPerformance.mockImplementation(() => time);

    // Frame 1: First press
    mockIsActionPressed.mockReturnValue(true);
    player.update(0.05, mockPhysics, mockControls, mockWorld);

    // Frame 2: Release
    time += 150;
    mockIsActionPressed.mockReturnValue(false);
    player.update(0.05, mockPhysics, mockControls, mockWorld);

    // Frame 3: Second press after 300ms (exceeds 250ms delay)
    time += 150; // Total 300ms from first press
    mockIsActionPressed.mockReturnValue(true);
    player.update(0.05, mockPhysics, mockControls, mockWorld);

    expect(player.isFlying).toBe(false); // Should not toggle

    spyPerformance.mockRestore();
  });

  test('should spawn at the water surface instead of water bottom if top block is water', () => {
    mockWorld.getBlock = vi.fn((x, y, z) => {
      const fx = Math.floor(x);
      const fz = Math.floor(z);
      if (fx === 8 && fz === 8) {
        if (y > 20) return BLOCK_TYPES.AIR;
        if (y === 20) return BLOCK_TYPES.WATER;
        return BLOCK_TYPES.STONE;
      }
      return BLOCK_TYPES.AIR;
    });

    player.spawn(mockWorld, mockPhysics);

    expect(player.position.y).toBeCloseTo(21.2);
  });

  test('should search for safe land spawn point near (8.5, 8.5) if center is water', () => {
    mockWorld.getBlock = vi.fn((x, y, z) => {
      const fx = Math.floor(x);
      const fz = Math.floor(z);
      
      if (fx === 11 && fz === 8) {
        if (y > 22) return BLOCK_TYPES.AIR;
        if (y === 22) return BLOCK_TYPES.GRASS;
        return BLOCK_TYPES.STONE;
      }
      
      if (y > 20) return BLOCK_TYPES.AIR;
      if (y === 20) return BLOCK_TYPES.WATER;
      return BLOCK_TYPES.STONE;
    });

    player.spawn(mockWorld, mockPhysics);

    expect(player.position.x).toBeCloseTo(11.5);
    expect(player.position.z).toBeCloseTo(8.5);
    expect(player.position.y).toBeCloseTo(23.2);
  });

  test('should offset spawn center dynamically for non-test seeds to prevent starting on rivers', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    // 1. 测试普通非测试种子：应该发生偏置
    const mockWorldReal = {
      getBlock: vi.fn((_x, y, _z) => {
        if (y === 50) return BLOCK_TYPES.GRASS;
        if (y < 50) return BLOCK_TYPES.STONE;
        return BLOCK_TYPES.AIR;
      }),
      getSeed: vi.fn(() => 'real-game-seed-123')
    } as unknown as World;

    const playerReal = new Player(camera);
    playerReal.spawn(mockWorldReal, mockPhysics);
    // 应该偏置，不在默认的 8.5 附近
    expect(playerReal.position.x).not.toBeCloseTo(8.5, 1);
    expect(playerReal.position.z).not.toBeCloseTo(8.5, 1);

    // 2. 测试以 -seed 结尾的测试种子：应该保持 8.5
    const mockWorldTest = {
      getBlock: vi.fn((_x, y, _z) => {
        if (y === 50) return BLOCK_TYPES.GRASS;
        if (y < 50) return BLOCK_TYPES.STONE;
        return BLOCK_TYPES.AIR;
      }),
      getSeed: vi.fn(() => 'adventure-seed')
    } as unknown as World;

    const playerTest = new Player(camera);
    playerTest.spawn(mockWorldTest, mockPhysics);
    // 应该保持在 8.5 默认原点
    expect(playerTest.position.x).toBeCloseTo(8.5, 1);
    expect(playerTest.position.z).toBeCloseTo(8.5, 1);

    randomSpy.mockRestore();
  });
});
