/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { World, getBlockProperties } from '@game/world/World';
import { Physics } from '@game/physics/Physics';
import { Controls } from '@game/systems/Controls';
import { sound } from '@game/systems/Sound';
import { FPSCounter } from './FPSCounter';
import { ParticleSystem } from '@game/systems/particles';
import { Player } from '@game/entities/Player';
import { GameState, GameMode, type DebugMetrics } from '@type';
import { useGameStore } from '@store/useGameStore';
import { EnvironmentManager } from './EnvironmentManager';
import { InteractionManager } from './InteractionManager';
import { DroppedItemManager } from './DroppedItemManager';
import { AnimalManager } from './AnimalManager';
import { WORLD_CONFIG } from '@game/world/WorldConfig';
import { cleanGpuName } from '@utils/gpu';

export class GameManager {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public world!: World;
  public physics!: Physics;
  public controls!: Controls;
  public player!: Player;
  public particles!: ParticleSystem;

  // Sub-managers
  public environment!: EnvironmentManager;
  public interaction!: InteractionManager;
  public droppedItems!: DroppedItemManager;
  public animals!: AnimalManager;

  public canvas: HTMLCanvasElement;
  private animationId: number | null = null;
  private lastTime = 0;

  // UI update throttling
  private lastUiUpdateTime = 0;

  // Settings
  public renderDistance = 4;

  // Debug metrics
  public debugOverlayVisible = false;
  public fpsCounter = new FPSCounter();

  constructor(canvas: HTMLCanvasElement, seed: string = 'cloudcraft') {
    this.canvas = canvas;

    this.initThree();
    this.initGame(seed);
    this.initListeners();
    
    this.lastTime = performance.now();
    this.animate();
  }

  private initThree() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x7ec0ee, 0.015);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  }

  private initGame(seed: string) {
    this.world = new World(seed, this);
    (window as any).gameInstance = this;
    this.scene.add(this.world.group);

    this.physics = new Physics(this.world);
    this.controls = new Controls(this.camera, this.canvas);

    this.controls.addLockChangeListener((locked) => {
      useGameStore.getState().setGameState(locked ? GameState.PLAYING : GameState.PAUSED);
      if (!locked) {
        if (this.interaction) {
          this.interaction.isLeftMouseDown = false;
          this.interaction.cancelMining();
        }
      }
    });

    this.player = new Player(this.camera, () => {
      useGameStore.getState().setIsDamaged(true);
      setTimeout(() => {
        useGameStore.getState().setIsDamaged(false);
      }, 250);
    });

    this.controls.onF3Pressed = () => {
      this.debugOverlayVisible = !this.debugOverlayVisible;
      sound.playClick();
      useGameStore.getState().setDebugOverlay(this.debugOverlayVisible);
    };

    this.controls.onF4Pressed = () => {
      if (useGameStore.getState().gameMode === GameMode.CREATIVE) {
        this.player.isFlying = !this.player.isFlying;
        sound.playClick();
      }
    };

    this.particles = new ParticleSystem(this.scene);
    this.player.spawn(this.world, this.physics);

    // Load chunks around spawn asynchronously to allow React to render the loading progress
    this.world.loadArea(this.player.position.x, this.player.position.y, this.player.position.z, 2, false);

    // Initialize Sub-managers
    this.environment = new EnvironmentManager(this);
    this.interaction = new InteractionManager(this);
    this.droppedItems = new DroppedItemManager(this);
    this.animals = new AnimalManager(this);

    // Subscribe to state changes in Zustand to sync with engine blockEntities and debug settings
    let prevChestInventory = useGameStore.getState().chestInventory;
    let prevDebugOverlay = useGameStore.getState().debugOverlay;
    
    // Sync initial debug overlay state
    this.debugOverlayVisible = prevDebugOverlay;

    useGameStore.subscribe((state) => {
      // Sync chest inventory
      const nextChest = state.chestInventory;
      if (nextChest !== prevChestInventory) {
        prevChestInventory = nextChest;
        const activeChest = state.activeChest;
        if (activeChest) {
          const entity = this.world.blockEntities.getEntity(activeChest.x, activeChest.y, activeChest.z);
          if (entity && 'inventory' in entity) {
            (entity as any).inventory = [...nextChest];
          }
        }
      }

      // Sync debugOverlay configuration
      const nextDebugOverlay = state.debugOverlay;
      if (nextDebugOverlay !== prevDebugOverlay) {
        prevDebugOverlay = nextDebugOverlay;
        this.debugOverlayVisible = nextDebugOverlay;
      }
    });
  }

  public spawnPlayer() {
    this.player.spawn(this.world, this.physics);
    this.world.loadArea(this.player.position.x, this.player.position.y, this.player.position.z, 2, true);
  }

  private initListeners() {
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private onResize = () => {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);

    const store = useGameStore.getState();
    const isPaused = (store.gameState === GameState.PAUSED || store.isSettingsOpen) && !store.isWorldLoading;
    if (isPaused && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.interaction) {
      this.interaction.onMouseDown(e);
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (this.interaction) {
      this.interaction.onMouseUp(e);
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    const store = useGameStore.getState();
    const isPaused = (store.gameState === GameState.PAUSED || store.isSettingsOpen) && !store.isWorldLoading;

    if (isPaused) {
      return;
    }

    if (dt > 0.15) dt = 0.15;

    this.fpsCounter.update();

    if (this.particles) {
      this.particles.update(dt);
    }

    const isPlaying = store.gameState === GameState.PLAYING &&
      !store.isInventoryOpen &&
      !store.activeChest &&
      !store.isWorldLoading;

    if (isPlaying) {
      if (this.environment) this.environment.update(dt);
      
      this.player.update(dt, this.physics, this.controls, this.world);
      const radius = store.isWorldLoading ? 2 : this.renderDistance;
      this.world.loadArea(this.player.position.x, this.player.position.y, this.player.position.z, radius);

      if (this.interaction) this.interaction.update(dt);
      if (this.droppedItems) this.droppedItems.update(dt);
      if (this.animals) this.animals.update(dt);
      this.world.update(dt);

      const currentMs = performance.now();
      if (currentMs - this.lastUiUpdateTime > 100) {
        this.lastUiUpdateTime = currentMs;
        useGameStore.getState().setPlayerState(
          {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
          },
          this.player.state.onGround,
          this.player.state.inWater,
          this.player.life,
          this.player.hunger
        );
        if (this.debugOverlayVisible) {
          useGameStore.getState().setDebugMetrics(this.getDebugMetrics());
        }
      }
    } else {
      // Background continues when game is paused/menus open
      if (this.environment) this.environment.update(dt);
      if (this.player) {
        const radius = store.isWorldLoading ? 2 : this.renderDistance;
        this.world.loadArea(this.player.position.x, this.player.position.y, this.player.position.z, radius);
      }
      this.world.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  public setRenderDistance(dist: number) {
    this.renderDistance = dist;
    if (this.world && this.player) {
      const store = useGameStore.getState();
      const radius = store.isWorldLoading ? 2 : this.renderDistance;
      this.world.loadArea(this.player.position.x, this.player.position.y, this.player.position.z, radius);
      
      const isPaused = (store.gameState === GameState.PAUSED || store.isSettingsOpen) && !store.isWorldLoading;
      if (isPaused && this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  public setFov(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    const store = useGameStore.getState();
    const isPaused = (store.gameState === GameState.PAUSED || store.isSettingsOpen) && !store.isWorldLoading;
    if (isPaused && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private getBlockName(id: number): string {
    return getBlockProperties(id).name;
  }

  public getDebugMetrics(): DebugMetrics {
    // 1. Target block info
    const targeted = this.interaction?.targetedBlockInfo;
    let targetBlock: DebugMetrics['targetBlock'] = null;
    if (targeted) {
      const blockId = this.world.getBlock(
        targeted.target.x,
        targeted.target.y,
        targeted.target.z
      );
      targetBlock = {
        id: blockId,
        type: this.getBlockName(blockId),
        x: targeted.target.x,
        y: targeted.target.y,
        z: targeted.target.z,
      };
    }

    // 2. Player position and rotation
    const playerPos = {
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
    };

    // Calculate Yaw & Pitch and Direction
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const yaw = Math.atan2(direction.x, direction.z) * 180 / Math.PI;
    const pitch = Math.asin(direction.y) * 180 / Math.PI;

    let dirStr = 'South (Towards +Z)';
    if (yaw >= 45 && yaw < 135) {
      dirStr = 'East (Towards +X)';
    } else if (yaw >= -135 && yaw < -45) {
      dirStr = 'West (Towards -X)';
    } else if (yaw < -45 || yaw >= 135) {
      dirStr = 'North (Towards -Z)';
    }

    // 3. Chunk coordinates
    const cx = Math.floor(playerPos.x / 16);
    const cy = Math.floor(playerPos.y / 16);
    const cz = Math.floor(playerPos.z / 16);
    const lx = ((Math.floor(playerPos.x) % 16) + 16) % 16;
    const ly = ((Math.floor(playerPos.y) % 16) + 16) % 16;
    const lz = ((Math.floor(playerPos.z) % 16) + 16) % 16;

    // 4. Biome, Landform and terrain height
    let biomeInfo: DebugMetrics['biome'] = null;
    let landformInfo: DebugMetrics['landform'] = null;
    let terrainHeight = 0;
    let currentSlope = 0;
    if (this.world && this.world.generator) {
      const terrainData = this.world.generator.getColumnTerrainData(playerPos.x, playerPos.z);
      terrainHeight = terrainData.finalHeight;
      currentSlope = terrainData.slope;
      
      const primaryBiome = this.world.generator.getPrimaryBiome(playerPos.x, playerPos.z);
      const primaryLandform = this.world.generator.getPrimaryLandform(playerPos.x, playerPos.z);

      if (primaryBiome) {
        biomeInfo = {
          id: primaryBiome.id,
          name: primaryBiome.name,
          temp: primaryBiome.targetTemp,
          moisture: primaryBiome.targetMoisture,
        };
      }
      if (primaryLandform) {
        const scale = WORLD_CONFIG.landform.scale;
        const c = (this.world.generator.getNoise().noise((playerPos.x + WORLD_CONFIG.landform.offsetC) * scale, (playerPos.z + WORLD_CONFIG.landform.offsetC) * scale) + 1) / 2;
        const e = (this.world.generator.getNoise().noise((playerPos.x + WORLD_CONFIG.landform.offsetE) * scale, (playerPos.z + WORLD_CONFIG.landform.offsetE) * scale) + 1) / 2;
        landformInfo = {
          id: primaryLandform.id,
          name: primaryLandform.name,
          continentalness: c,
          erosion: e,
        };
      }
    }

    // 5. Game time
    let gameTimeVal = 0;
    let formattedTime = '00:00';
    if (this.environment) {
      const rawTime = this.environment.getGameTime();
      const duration = this.environment.getDayDuration();
      gameTimeVal = rawTime;
      const ratio = duration > 0 ? rawTime / duration : 0;
      const totalMinutes = Math.floor(ratio * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // 6. Entity count
    const droppedItemsCount = this.droppedItems ? this.droppedItems.getCount() : 0;
    const animalsCount = this.animals ? this.animals.getCount() : 0;

    // 7. Renderer Info
    let gpuName = 'Unknown';
    if (this.renderer) {
      const gl = this.renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
      } else {
        gpuName = 'Standard WebGL';
      }
    }

    const rendererInfo = {
      drawCalls: this.renderer ? this.renderer.info.render.calls : 0,
      triangles: this.renderer ? this.renderer.info.render.triangles : 0,
      geometries: this.renderer ? this.renderer.info.memory.geometries : 0,
      textures: this.renderer ? this.renderer.info.memory.textures : 0,
      gpu: cleanGpuName(gpuName),
    };

    return {
      fps: this.fpsCounter.getFPS(),
      chunksLoaded: this.world.getRenderer().getChunkMeshes().size,
      chunkLoadSpeed: this.world && this.world.getRenderer() ? this.world.getRenderer().getChunkLoadSpeed() : 0,
      isFlying: this.player.isFlying,
      targetBlock,
      playerPosition: playerPos,
      playerDirection: dirStr,
      playerRotation: { yaw, pitch },
      chunkCoords: { cx, cy, cz, lx, ly, lz },
      biome: biomeInfo,
      landform: landformInfo,
      slope: currentSlope,
      terrainHeight,
      gameTime: {
        time: gameTimeVal,
        formatted: formattedTime,
      },
      entities: {
        droppedItems: droppedItemsCount,
        animals: animalsCount,
      },
      renderer: rendererInfo,
    };
  }

  public dispose() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    }
    window.removeEventListener('mouseup', this.onMouseUp);

    if (this.controls) this.controls.dispose();
    if (this.world) this.world.dispose();
    if (this.renderer) this.renderer.dispose();

    if (this.environment) {
      this.environment.dispose();
    }
    if (this.interaction) this.interaction.dispose();
    if (this.droppedItems) this.droppedItems.dispose();
    if (this.animals) this.animals.dispose();
    if (this.particles) {
      this.particles.clear();
    }
  }
}
