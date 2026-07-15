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
import { mountDevConsole } from '../dev';
import { WorldFixtureManager } from '@game/fixtures/WorldFixtureManager';
import { ThreeFixtureView } from '@game/fixtures/ThreeFixtureView';
import type { SaveData } from '@game/systems/SaveManager';
import type { ChunkStreamingView } from '@game/world/streaming/ChunkVisibilityResolver';
import { GameSaveCoordinator } from './GameSaveCoordinator';
import { createGameFixtureRuntime } from './GameFixtureRuntime';
import { GameStoreBridge } from './GameStoreBridge';

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
  public fixtures!: WorldFixtureManager;
  public fixtureView!: ThreeFixtureView;

  public canvas: HTMLCanvasElement;
  private animationId: number | null = null;
  private lastTime = 0;
  private readonly chunkStreamingDirection = new THREE.Vector3();
  private readonly chunkStreamingView = {
    position: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    verticalFovRadians: 0,
    aspect: 1,
  } satisfies ChunkStreamingView;

  // UI update throttling
  private lastUiUpdateTime = 0;
  private saveCoordinator!: GameSaveCoordinator;
  private storeBridge!: GameStoreBridge;

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
    const width = Math.max(1, this.canvas.clientWidth || 1);
    const height = Math.max(1, this.canvas.clientHeight || 1);

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

    // Guard against 0x0 canvas (aspect NaN/Infinity) which used to disable frustum culling.
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  }

  private initGame(seed: string) {
    this.world = new World(seed, this);
    this.scene.add(this.world.group);

    this.physics = new Physics(this.world);
    this.controls = new Controls(this.camera, this.canvas, this);

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

    const fixtureRuntime = createGameFixtureRuntime(this.scene, this.world);
    this.fixtureView = fixtureRuntime.view;
    this.fixtures = fixtureRuntime.manager;

    // Load chunks around spawn asynchronously to allow React to render the loading progress
    this.loadAreaAroundPlayer(2);

    // Initialize Sub-managers
    this.environment = new EnvironmentManager(this);
    this.interaction = new InteractionManager(this);
    this.droppedItems = new DroppedItemManager(this);
    this.animals = new AnimalManager(this);
    this.saveCoordinator = new GameSaveCoordinator({
      world: this.world,
      player: this.player,
      entities: this.animals,
      fixtures: this.fixtures,
      environment: this.environment,
    });

    this.storeBridge = new GameStoreBridge(this);

    mountDevConsole(this);
  }

  public captureSaveData(): SaveData {
    return this.saveCoordinator.capture();
  }

  public restoreSaveData(save: SaveData): void {
    this.saveCoordinator.restore(save);
  }

  public spawnPlayer() {
    this.player.spawn(this.world, this.physics);
    this.loadAreaAroundPlayer(2, true);
  }

  private updateChunkStreamingView(): ChunkStreamingView | null {
    if (!this.camera) return null;

    this.camera.getWorldDirection(this.chunkStreamingDirection);
    this.chunkStreamingView.position.x = this.camera.position.x;
    this.chunkStreamingView.position.y = this.camera.position.y;
    this.chunkStreamingView.position.z = this.camera.position.z;
    this.chunkStreamingView.forward.x = this.chunkStreamingDirection.x;
    this.chunkStreamingView.forward.y = this.chunkStreamingDirection.y;
    this.chunkStreamingView.forward.z = this.chunkStreamingDirection.z;
    const fovRadians = THREE.MathUtils.degToRad(this.camera.fov);
    this.chunkStreamingView.verticalFovRadians = (
      Number.isFinite(fovRadians) && fovRadians > 0 && fovRadians < Math.PI
    )
      ? fovRadians
      : THREE.MathUtils.degToRad(75);
    const aspect = this.camera.aspect;
    this.chunkStreamingView.aspect = (
      Number.isFinite(aspect) && aspect > 0
    )
      ? aspect
      : 16 / 9;
    return this.chunkStreamingView;
  }

  private loadAreaAroundPlayer(radius: number, sync = false): void {
    this.world.loadArea(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z,
      radius,
      sync,
      sync ? null : this.updateChunkStreamingView(),
    );
  }

  private initListeners() {
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private onResize = () => {
    const width = Math.max(1, this.canvas.clientWidth || 1);
    const height = Math.max(1, this.canvas.clientHeight || 1);
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
      this.loadAreaAroundPlayer(radius);

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
        this.loadAreaAroundPlayer(radius);
      }
      this.world.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  public applyShadowQuality(quality: 'simple' | 'fancy') {
    const isFancy = quality === 'fancy';
    if (this.renderer) {
      this.renderer.shadowMap.enabled = isFancy;
    }
    
    // 置脏 ChunkRenderer 材质以要求重新生成 shader
    if (this.world) {
      const renderer = this.world.getRenderer();
      if (renderer && renderer.materials) {
        const chunkMaterials = [
          renderer.materials.solid,
          renderer.materials.transparent,
          renderer.materials.cutout
        ];
        chunkMaterials.forEach(m => {
          if (m) m.needsUpdate = true;
        });
      }
    }
    
    // 置脏动物材质
    if (this.animals && typeof this.animals.markMaterialsDirty === 'function') {
      this.animals.markMaterialsDirty();
    }
    
    // 若切为 simple，立即禁用 sun shadow，防止 shadow map 相关的渲染流程继续工作
    if (!isFancy && this.environment && this.environment.sun) {
      this.environment.sun.light.castShadow = false;
    }
  }

  public setRenderDistance(dist: number) {
    this.renderDistance = dist;
    if (this.world && this.player) {
      const store = useGameStore.getState();
      const radius = store.isWorldLoading ? 2 : this.renderDistance;
      this.loadAreaAroundPlayer(radius);
      
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
      this.animationId = null;
    }
    window.removeEventListener('resize', this.onResize);
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    }
    window.removeEventListener('mouseup', this.onMouseUp);

    this.storeBridge?.dispose();

    if (this.controls) this.controls.dispose();
    if (this.interaction) this.interaction.dispose();
    if (this.droppedItems) this.droppedItems.dispose();
    if (this.animals) this.animals.dispose();
    if (this.particles) {
      this.particles.clear();
    }
    if (this.fixtures) this.fixtures.dispose();
    if (this.environment) this.environment.dispose();
    if (this.world) this.world.dispose();
    if (this.renderer) this.renderer.dispose();

    if (import.meta.env.DEV) {
      delete window.__cloudcraft__;
    }
  }
}
