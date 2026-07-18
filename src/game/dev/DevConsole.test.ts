import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createDevConsole } from './DevConsole';
import type { GameManager } from '../core/GameManager';
import { useGameStore } from '@store/useGameStore';
import * as THREE from 'three';

describe('DevConsole', () => {
  let mockGame: GameManager;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear Zustand store state to keep tests isolated
    useGameStore.setState({
      gameMode: 'adventure',
      hotbar: Array(9).fill(null),
      activeSlot: 0
    });

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a mock GameManager instance
    mockGame = {
      world: {
        getSeed: vi.fn().mockReturnValue('test-seed-12345'),
        getBlock: vi.fn().mockReturnValue(1),
        setBlock: vi.fn(),
        saveWorld: vi.fn().mockReturnValue('{"blocks":{}}'),
        chunks: {
          size: 10
        },
        generator: {
          getPrimaryBiome: vi.fn().mockReturnValue({ id: 'desert' }),
          getPrimaryLandform: vi.fn().mockReturnValue({ id: 'mountains' }),
          getColumnTerrainData: vi.fn().mockReturnValue({ finalHeight: 64 })
        },
        loadArea: vi.fn()
      },
      player: {
        position: {
          x: 10,
          y: 64,
          z: 20,
          set: vi.fn().mockImplementation((x: number, y: number, z: number) => {
            mockGame.player.position.x = x;
            mockGame.player.position.y = y;
            mockGame.player.position.z = z;
          })
        },
        velocity: {
          x: 0,
          y: 0,
          z: 0,
          set: vi.fn().mockImplementation((x: number, y: number, z: number) => {
            mockGame.player.velocity.x = x;
            mockGame.player.velocity.y = y;
            mockGame.player.velocity.z = z;
          })
        },
        syncCamera: vi.fn(),
        life: 10,
        hunger: 20,
        isFlying: false,
        state: {
          onGround: true
        },
        spawn: vi.fn(),
        takeDamage: vi.fn()
      },
      physics: {},
      environment: {
        getGameTime: vi.fn().mockReturnValue(100),
        getDayDuration: vi.fn().mockReturnValue(1200),
        state: {
          gameTime: 100
        },
        setWeather: vi.fn(),
        setDimension: vi.fn()
      },
      camera: {
        fov: 75,
        updateProjectionMatrix: vi.fn(),
        getWorldDirection: vi.fn().mockImplementation((target: THREE.Vector3) => {
          target.set(0, 0, -1);
          return target;
        })
      },
      renderer: {
        shadowMap: {
          type: 0,
          needsUpdate: false
        },
        info: {
          render: {
            calls: 50,
            triangles: 1000
          },
          memory: {
            geometries: 20,
            textures: 5
          }
        }
      },
      scene: {
        traverse: vi.fn(),
        add: vi.fn(),
        remove: vi.fn()
      },
      fpsCounter: {
        getFPS: vi.fn().mockReturnValue(60)
      },
      getDebugMetricsSnapshot: vi.fn().mockReturnValue({
        fps: 60,
        chunksLoaded: 10,
        playerPosition: { x: 10, y: 64, z: 20 }
      }),
      setRenderDistance: vi.fn(),
      renderDistance: 4,
      animals: {
        listSpeciesIds: vi.fn().mockReturnValue(['cloudcraft:pig', 'cloudcraft:leopard']),
        getAnimals: vi.fn().mockReturnValue([]),
        getCount: vi.fn().mockReturnValue(0),
        clearAnimals: vi.fn().mockReturnValue(0),
        spawnSpecies: vi.fn().mockImplementation((speciesId: string, position: THREE.Vector3) => {
          const type = speciesId.includes(':')
            ? speciesId
            : `cloudcraft:${speciesId.toLowerCase()}`;
          if (type !== 'cloudcraft:pig' && type !== 'cloudcraft:leopard') {
            return null;
          }
          return {
            id: `${type.split(':').at(-1)}-dev-test`,
            type,
            position: position.clone(),
            life: 10,
            maxLife: 10,
            isPersistent: true,
            isDead: false
          };
        })
      }
    } as unknown as GameManager;
  });

  // Clean up spies
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  test('should create dev console with expected namespaces', () => {
    const devConsole = createDevConsole(mockGame);
    expect(devConsole.meta).toBeDefined();
    expect(devConsole.player).toBeDefined();
    expect(devConsole.world).toBeDefined();
    expect(devConsole.time).toBeDefined();
    expect(devConsole.render).toBeDefined();
    expect(devConsole.store).toBeDefined();
    expect(devConsole.debug).toBeDefined();
    expect(devConsole.entity).toBeDefined();
  });

  describe('meta namespace', () => {
    test('help() should print command lists', () => {
      const devConsole = createDevConsole(mockGame);
      const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      devConsole.meta.help();

      expect(groupSpy).toHaveBeenCalled();
      expect(tableSpy).toHaveBeenCalled();
      expect(groupEndSpy).toHaveBeenCalled();

      groupSpy.mockRestore();
      tableSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    test('version should return string', () => {
      const devConsole = createDevConsole(mockGame);
      expect(devConsole.meta.version).toBe('0.3.0');
    });

    test('seed() should query game seed', () => {
      const devConsole = createDevConsole(mockGame);
      expect(devConsole.meta.seed()).toBe('test-seed-12345');
      expect(mockGame.world.getSeed).toHaveBeenCalled();
    });
  });

  describe('player namespace', () => {
    test('teleport() should update player position and sync camera', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.player.teleport(100, 80, 200);

      expect(mockGame.player.position.x).toBe(100);
      expect(mockGame.player.position.y).toBe(80);
      expect(mockGame.player.position.z).toBe(200);
      expect(mockGame.player.syncCamera).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Teleported player to: 100, 80, 200');
    });

    test('teleport() should error on invalid types', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.player.teleport('100' as unknown as number, 80, 200);

      expect(mockGame.player.syncCamera).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('teleportToBiome() should look up and teleport to matched biome', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.player.teleportToBiome('desert');

      expect(mockGame.world.generator.getPrimaryBiome).toHaveBeenCalled();
      expect(mockGame.player.syncCamera).toHaveBeenCalled();
    });

    test('teleportToLandform() should look up and teleport to matched landform', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.player.teleportToLandform('mountains');

      expect(mockGame.world.generator.getPrimaryLandform).toHaveBeenCalled();
      expect(mockGame.player.syncCamera).toHaveBeenCalled();
    });

    test('setHealth() should clamp value and apply it', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.player.setHealth(8);
      expect(mockGame.player.life).toBe(8);

      devConsole.player.setHealth(15); // Clamp to 10
      expect(mockGame.player.life).toBe(10);
    });

    test('setHunger() should clamp value and apply it', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.player.setHunger(12);
      expect(mockGame.player.hunger).toBe(12);
    });

    test('setFlying() should update isFlying and fallback to creative if adventure', () => {
      const devConsole = createDevConsole(mockGame);
      expect(useGameStore.getState().gameMode).toBe('adventure');

      devConsole.player.setFlying(true);
      expect(mockGame.player.isFlying).toBe(true);
      // Auto-switched mode to creative
      expect(useGameStore.getState().gameMode).toBe('creative');
    });

    test('getStatus() should return player states', () => {
      const devConsole = createDevConsole(mockGame);
      const status = devConsole.player.getStatus();
      expect(status.position).toEqual({ x: 10, y: 64, z: 20 });
      expect(status.life).toBe(10);
      expect(status.isFlying).toBe(false);
    });

    test('respawn() should call player spawn', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.player.respawn();
      expect(mockGame.player.spawn).toHaveBeenCalled();
    });
  });

  describe('world namespace', () => {
    test('getBlock() and setBlock() should forward calls', () => {
      const devConsole = createDevConsole(mockGame);
      expect(devConsole.world.getBlock(1, 2, 3)).toBe(1);
      expect(mockGame.world.getBlock).toHaveBeenCalledWith(1, 2, 3);

      devConsole.world.setBlock(10, 20, 30, 2);
      expect(mockGame.world.setBlock).toHaveBeenCalledWith(10, 20, 30, 2);
    });

    test('fill() should batch-place blocks and respect 8192 limits', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.world.fill(0, 0, 0, 9, 9, 9, 1); // 1000 blocks
      expect(mockGame.world.setBlock).toHaveBeenCalledTimes(1000);

      // Exceeds limit
      expect(() => {
        devConsole.world.fill(0, 0, 0, 20, 20, 20, 1); // 21 * 21 * 21 = 9261 blocks
      }).toThrow('Total blocks to fill (9261) exceeds limit of 8192');
    });

    test('getInfo() and save() should query world states', () => {
      const devConsole = createDevConsole(mockGame);
      expect(devConsole.world.getInfo()).toEqual({ seed: 'test-seed-12345', loadedChunks: 10 });
      expect(devConsole.world.save()).toBe('{"blocks":{}}');
    });
  });

  describe('time namespace', () => {
    test('get() and set() should access time states', () => {
      const devConsole = createDevConsole(mockGame);
      expect(devConsole.time.get()).toBe(100);

      devConsole.time.set(500);
      expect(mockGame.environment.state.gameTime).toBe(500);
    });

    test('setWeather() and setDimension() should update environment properties', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.time.setWeather('rain');
      expect(mockGame.environment.setWeather).toHaveBeenCalledWith('rain');

      devConsole.time.setDimension('nether');
      expect(mockGame.environment.setDimension).toHaveBeenCalledWith('nether');
    });
  });

  describe('render namespace', () => {
    test('setRenderDistance() should clamp and delegate to the game manager', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.render.setRenderDistance(20);
      expect(mockGame.setRenderDistance).toHaveBeenCalledWith(16);
    });

    test('setFov() should change camera fov', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.render.setFov(90);
      expect(mockGame.camera.fov).toBe(90);
      expect(mockGame.camera.updateProjectionMatrix).toHaveBeenCalled();
    });

    test('setShadowQuality() should update renderer shadow map type', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.render.setShadowQuality('fancy');
      expect(mockGame.renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
    });

    test('getStats() should return render details', () => {
      const devConsole = createDevConsole(mockGame);
      const stats = devConsole.render.getStats();
      expect(stats.fps).toBe(60);
      expect(stats.drawCalls).toBe(50);
      expect(stats.triangles).toBe(1000);
    });
  });

  describe('store namespace', () => {
    test('get() should return store state', () => {
      const devConsole = createDevConsole(mockGame);
      const state = devConsole.store.get();
      expect(state.gameMode).toBe('adventure');
    });

    test('setGameMode() should change game mode', () => {
      const devConsole = createDevConsole(mockGame);
      devConsole.store.setGameMode('creative');
      expect(useGameStore.getState().gameMode).toBe('creative');
    });

    test('giveItem() should add item to hotbar', () => {
      const devConsole = createDevConsole(mockGame);
      // Give valid item
      const success = devConsole.store.giveItem('stone', 5);
      expect(success).toBe(true);
      expect(useGameStore.getState().hotbar[0]).toEqual({ type: 'stone', count: 5 });

      // Give invalid item
      const successFail = devConsole.store.giveItem('invalid_item_type_abc', 1);
      expect(successFail).toBe(false);
    });
  });

  describe('debug namespace', () => {
    test('getMetrics() should return the debug panel metrics snapshot', () => {
      const devConsole = createDevConsole(mockGame);
      const metrics = devConsole.debug.getMetrics();

      expect(mockGame.getDebugMetricsSnapshot).toHaveBeenCalled();
      expect(metrics.fps).toBe(60);
      expect(metrics.playerPosition).toEqual({ x: 10, y: 64, z: 20 });
    });
  });

  describe('entity namespace', () => {
    test('listSpecies() should return registered species ids', () => {
      const devConsole = createDevConsole(mockGame);
      expect(devConsole.entity.listSpecies()).toEqual([
        'cloudcraft:pig',
        'cloudcraft:leopard',
      ]);
      expect(mockGame.animals.listSpeciesIds).toHaveBeenCalled();
    });

    test('spawn() without coords should place animal in front of player', () => {
      const devConsole = createDevConsole(mockGame);
      const result = devConsole.entity.spawn('pig');

      expect(result).not.toBeNull();
      expect(result?.type).toBe('cloudcraft:pig');
      expect(mockGame.animals.spawnSpecies).toHaveBeenCalled();
      const [, position, options] = (mockGame.animals.spawnSpecies as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(position.x).toBeCloseTo(10);
      expect(position.y).toBeCloseTo(64);
      expect(position.z).toBeCloseTo(17); // player z=20, camera forward -Z * 3
      expect(options).toEqual({ persistent: true });
    });

    test('spawn() with coords should use exact position', () => {
      const devConsole = createDevConsole(mockGame);
      const result = devConsole.entity.spawn('leopard', 1, 2, 3);

      expect(result?.type).toBe('cloudcraft:leopard');
      const [, position] = (mockGame.animals.spawnSpecies as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(position.x).toBe(1);
      expect(position.y).toBe(2);
      expect(position.z).toBe(3);
    });

    test('spawn() should reject unknown species', () => {
      const devConsole = createDevConsole(mockGame);
      const result = devConsole.entity.spawn('dragon');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('spawn() should reject partial coordinates', () => {
      const devConsole = createDevConsole(mockGame);
      const result = devConsole.entity.spawn('pig', 1, 2);

      expect(result).toBeNull();
      expect(mockGame.animals.spawnSpecies).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('spawnMany() should spawn multiple animals', () => {
      const devConsole = createDevConsole(mockGame);
      const results = devConsole.entity.spawnMany('pig', 3, 4);

      expect(results).toHaveLength(3);
      expect(mockGame.animals.spawnSpecies).toHaveBeenCalledTimes(3);
    });

    test('list() / count() / clear() should delegate to AnimalManager', () => {
      const animal = {
        id: 'pig-1',
        type: 'cloudcraft:pig',
        position: { x: 1, y: 2, z: 3 },
        life: 8,
        maxLife: 10,
        isPersistent: true,
        isDead: false,
      };
      (mockGame.animals.getAnimals as ReturnType<typeof vi.fn>).mockReturnValue([animal]);
      (mockGame.animals.getCount as ReturnType<typeof vi.fn>).mockReturnValue(1);
      (mockGame.animals.clearAnimals as ReturnType<typeof vi.fn>).mockReturnValue(1);

      const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
      const devConsole = createDevConsole(mockGame);

      expect(devConsole.entity.list()).toEqual([
        {
          id: 'pig-1',
          type: 'cloudcraft:pig',
          position: { x: 1, y: 2, z: 3 },
          life: 8,
          maxLife: 10,
          isPersistent: true,
          isDead: false,
        },
      ]);
      expect(devConsole.entity.count()).toBe(1);
      expect(devConsole.entity.clear()).toBe(1);
      expect(mockGame.animals.clearAnimals).toHaveBeenCalled();

      tableSpy.mockRestore();
    });
  });
});
