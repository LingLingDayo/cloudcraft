/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import { World, getBlockProperties } from '@game/world/World';
import { Physics } from '@game/physics/Physics';
import { Controls } from '@game/systems/Controls';
import { sound } from '@game/systems/Sound';
import { FPSCounter } from './FPSCounter';
import { ParticleSystem } from '@game/systems/Particles';
import { Player } from '@game/entities/Player';
import { GameState, GameMode, type DebugMetrics } from '@type';
import { useGameStore } from '@store/useGameStore';
import { EnvironmentManager } from './EnvironmentManager';
import { InteractionManager } from './InteractionManager';
import { DroppedItemManager } from './DroppedItemManager';
import { AnimalManager } from './AnimalManager';

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
  public renderDistance = 3;

  // Debug metrics
  public debugOverlayVisible = false;
  public fpsCounter = new FPSCounter();

  constructor(canvas: HTMLCanvasElement, seed: string = 'minicraft') {
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
    this.world.loadArea(this.player.position.x, this.player.position.z, 2, false);

    // Initialize Sub-managers
    this.environment = new EnvironmentManager(this);
    this.interaction = new InteractionManager(this);
    this.droppedItems = new DroppedItemManager(this);
    this.animals = new AnimalManager(this);
  }

  public spawnPlayer() {
    this.player.spawn(this.world, this.physics);
    this.world.loadArea(this.player.position.x, this.player.position.z, 2, true);
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

    if (dt > 0.15) dt = 0.15;

    this.fpsCounter.update();

    if (this.particles) {
      this.particles.update(dt);
    }

    if (this.controls.isLocked) {
      if (this.environment) this.environment.update(dt);
      
      this.player.update(dt, this.physics, this.controls, this.world);
      this.world.loadArea(this.player.position.x, this.player.position.z, this.renderDistance);

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
          this.player.life
        );
        if (this.debugOverlayVisible) {
          useGameStore.getState().setDebugMetrics(this.getDebugMetrics());
        }
      }
    } else {
      // Background continues when game is paused/menus open
      if (this.environment) this.environment.update(dt);
      if (this.player) {
        this.world.loadArea(this.player.position.x, this.player.position.z, this.renderDistance);
      }
      this.world.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  public setRenderDistance(dist: number) {
    this.renderDistance = dist;
    if (this.world && this.player) {
      this.world.loadArea(this.player.position.x, this.player.position.z, this.renderDistance);
    }
  }

  public setFov(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  private getBlockName(id: number): string {
    return getBlockProperties(id).name;
  }

  public getDebugMetrics(): DebugMetrics {
    const targeted = this.interaction?.targetedBlockInfo;
    if (targeted) {
      const blockId = this.world.getBlock(
        targeted.target.x,
        targeted.target.y,
        targeted.target.z
      );
      return {
        fps: this.fpsCounter.getFPS(),
        chunksLoaded: this.world.group.children.length / 2,
        isFlying: this.player.isFlying,
        targetBlock: {
          id: blockId,
          type: this.getBlockName(blockId),
          x: targeted.target.x,
          y: targeted.target.y,
          z: targeted.target.z,
        },
      };
    }
    return {
      fps: this.fpsCounter.getFPS(),
      chunksLoaded: this.world.group.children.length / 2,
      isFlying: this.player.isFlying,
      targetBlock: null,
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
  }
}
