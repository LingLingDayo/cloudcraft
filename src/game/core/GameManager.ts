import * as THREE from 'three';
import { World, BLOCK_TYPES, getBlockProperties } from '@game/world/World';
import { Physics } from '@game/physics/Physics';
import { Controls } from '@game/systems/Controls';
import { sound } from '@game/systems/Sound';
import { FPSCounter } from './FPSCounter';
import { ParticleSystem } from '@game/systems/Particles';
import { Player } from '@game/entities/Player';
import type { DebugMetrics } from '@type';
import { useGameStore } from '@store/useGameStore';

const BLOCK_COLORS: Record<number, number> = {
  [BLOCK_TYPES.GRASS]: 0x56a032,
  [BLOCK_TYPES.DIRT]: 0x825a3c,
  [BLOCK_TYPES.STONE]: 0x787878,
  [BLOCK_TYPES.WOOD]: 0x78552d,
  [BLOCK_TYPES.LEAF]: 0x2d7823,
  [BLOCK_TYPES.BRICK]: 0xa03c2d,
  [BLOCK_TYPES.GLASS]: 0xe0f7fa,
  [BLOCK_TYPES.WATER]: 0x286edc,
  [BLOCK_TYPES.SAND]: 0xdccd8c,
  [BLOCK_TYPES.COAL]: 0x282828,
  [BLOCK_TYPES.IRON]: 0xbe825a,
  [BLOCK_TYPES.DIAMOND]: 0x5cdcfa,
};

export class GameManager {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public world!: World;
  public physics!: Physics;
  public controls!: Controls;
  public player!: Player;

  private canvas: HTMLCanvasElement;
  private animationId: number | null = null;
  private lastTime = 0;

  // UI update throttling
  private lastUiUpdateTime = 0;

  // Day-Night cycle properties
  private gameTime = 60; // Start at 60s (noon)
  private dayDuration = 240; // 4 minutes per day
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  // Interaction properties
  private selectionBox!: THREE.Mesh;
  private targetedBlockInfo: { target: THREE.Vector3; place: THREE.Vector3 } | null = null;

  // Mining state properties
  private isMining = false;
  private isLeftMouseDown = false;
  private miningBlockPos = new THREE.Vector3();
  private miningTime = 0;
  private miningBreakTime = 0;
  private lastDigSoundTime = 0;
  private lastDigParticleTime = 0;
  private crackTextures: THREE.Texture[] = [];
  private crackMesh!: THREE.Mesh;

  // Settings
  public renderDistance = 3; // radius in chunks

  // Debug metrics
  public debugOverlayVisible = false;
  public fpsCounter = new FPSCounter();

  // Particles & Damage Hook
  public particles!: ParticleSystem;

  constructor(
    canvas: HTMLCanvasElement,
    seed: string = 'minicraft'
  ) {
    this.canvas = canvas;

    this.initThree();
    this.initGame(seed);
    this.initListeners();
    
    // Start loop
    this.lastTime = performance.now();
    this.animate();
  }

  private initThree() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // Turn off antialiasing for pixelated vibe
      alpha: false,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x7ec0ee, 0.015);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    
    // Lights
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(20, 40, 20);
    this.dirLight.castShadow = true;
    
    // Shadow settings
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 150;
    const d = 40;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Selection helper outline
    const selectGeo = new THREE.BoxGeometry(1.008, 1.008, 1.008);
    const selectMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    this.selectionBox = new THREE.Mesh(selectGeo, selectMat);
    this.scene.add(this.selectionBox);
  }

  private initGame(seed: string) {
    this.world = new World(seed);
    this.scene.add(this.world.group);

    this.physics = new Physics(this.world);
    this.controls = new Controls(this.camera, this.canvas);

    // Bind pause trigger when pointer lock changes
    this.controls.addLockChangeListener((locked) => {
      useGameStore.getState().setGameState(locked ? 'PLAYING' : 'PAUSED');
      if (!locked) {
        this.isLeftMouseDown = false;
        this.cancelMining();
      }
    });

    // Initialize Player
    this.player = new Player(this.camera, () => {
      useGameStore.getState().setIsDamaged(true);
      setTimeout(() => {
        useGameStore.getState().setIsDamaged(false);
      }, 250);
    });

    // Setup F3 & F4 triggers
    this.controls.onF3Pressed = () => {
      this.debugOverlayVisible = !this.debugOverlayVisible;
      sound.playClick();
      useGameStore.getState().setDebugOverlay(this.debugOverlayVisible);
    };

    this.controls.onF4Pressed = () => {
      if (useGameStore.getState().gameMode === 'creative') {
        this.player.isFlying = !this.player.isFlying;
        sound.playClick();
      }
    };

    this.particles = new ParticleSystem(this.scene);

    // Spawn player on safe dry ground
    this.player.spawn(this.world, this.physics);

    this.initCrackTextures();
    this.initCrackMesh();
  }

  public spawnPlayer() {
    this.player.spawn(this.world, this.physics);
  }

  private initListeners() {
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    // Prevent right click menu in game
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
    if (!this.controls.isLocked) return;

    // Refresh targeted block before interaction
    this.updateTargetedBlock();

    if (!this.targetedBlockInfo) return;

    if (e.button === 0) {
      this.isLeftMouseDown = true;
      // Left Click: Break Block
      const { target } = this.targetedBlockInfo;
      const blockId = this.world.getBlock(target.x, target.y, target.z);
      const props = getBlockProperties(blockId);
      if (blockId !== BLOCK_TYPES.AIR && !props.isLiquid && props.hardness >= 0) {
        const isCreative = useGameStore.getState().gameMode === 'creative';
        if (isCreative) {
          this.world.setBlock(target.x, target.y, target.z, BLOCK_TYPES.AIR);
          sound.playBreak();
          
          // Spawn particle blast
          const color = BLOCK_COLORS[blockId] ?? 0x787878;
          this.particles.spawn(
            new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5),
            color,
            15
          );
        } else {
          this.isMining = true;
          this.miningBlockPos.copy(target);
          this.miningTime = 0;
          this.miningBreakTime = props.hardness * 1.0;
          this.lastDigSoundTime = 0;
          this.lastDigParticleTime = 0;
        }
      }
    } else if (e.button === 2) {
      // Right Click: Place Block
      const { place } = this.targetedBlockInfo;
      
      // Make sure placement doesn't overlap player bounding box
      const blockBox = new THREE.Box3(
        place,
        new THREE.Vector3(place.x + 1, place.y + 1, place.z + 1)
      );
      const playerBox = this.physics.getPlayerBox(this.player.position);

      if (!playerBox.intersectsBox(blockBox)) {
        this.world.setBlock(place.x, place.y, place.z, this.player.selectedBlockType);
        sound.playPlace();

        // Spawn placement dust particles
        const color = BLOCK_COLORS[this.player.selectedBlockType] ?? 0xffffff;
        this.particles.spawn(
          new THREE.Vector3(place.x + 0.5, place.y + 0.5, place.z + 0.5),
          color,
          8
        );
      }
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isLeftMouseDown = false;
      this.cancelMining();
    }
  };

  private cancelMining() {
    this.isMining = false;
    if (this.crackMesh) {
      this.crackMesh.visible = false;
    }
    const circle = document.getElementById('mining-progress-circle');
    const svg = circle?.parentElement as HTMLElement | null;
    if (svg) svg.style.display = 'none';
  }

  private initCrackTextures() {
    this.crackTextures = [];
    const segments = [
      [2, 3, 6, 8],
      [6, 8, 11, 4],
      [11, 4, 14, 11],
      [6, 8, 5, 13],
      [5, 13, 2, 12],
      [11, 4, 9, 2],
      [2, 3, 4, 1],
      [14, 11, 15, 14],
      [5, 13, 9, 13],
      [9, 13, 13, 9]
    ];

    for (let stage = 1; stage <= 10; stage++) {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 16, 16);

      // Draw pixelated cracks
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'square';

      ctx.beginPath();
      for (let i = 0; i < Math.min(stage, segments.length); i++) {
        const seg = segments[i];
        ctx.moveTo(seg[0], seg[1]);
        ctx.lineTo(seg[2], seg[3]);
      }
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      this.crackTextures.push(texture);
    }
  }

  private initCrackMesh() {
    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const mat = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0], // 预先指定占位图以确保着色器编译纹理采样逻辑
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.crackMesh = new THREE.Mesh(geo, mat);
    this.crackMesh.visible = false; // 初始为隐藏状态
    this.scene.add(this.crackMesh);
  }

  private updateMining(dt: number) {
    const isCreative = useGameStore.getState().gameMode === 'creative';
    
    if (isCreative) {
      this.cancelMining();
      return;
    }

    if (!this.isMining) {
      if (this.isLeftMouseDown && this.targetedBlockInfo) {
        const { target } = this.targetedBlockInfo;
        const blockId = this.world.getBlock(target.x, target.y, target.z);
        const props = getBlockProperties(blockId);
        if (blockId !== BLOCK_TYPES.AIR && !props.isLiquid && props.hardness >= 0) {
          this.isMining = true;
          this.miningBlockPos.copy(target);
          this.miningTime = 0;
          this.miningBreakTime = props.hardness * 1.0;
          this.lastDigSoundTime = 0;
          this.lastDigParticleTime = 0;
        }
      } else {
        this.cancelMining();
        return;
      }
    }

    // Check if target is still the same block and still locked
    if (!this.targetedBlockInfo || !this.targetedBlockInfo.target.equals(this.miningBlockPos)) {
      this.cancelMining();
      return;
    }

    const target = this.miningBlockPos;
    const blockId = this.world.getBlock(target.x, target.y, target.z);
    const props = getBlockProperties(blockId);

    if (blockId === BLOCK_TYPES.AIR || props.isLiquid || props.hardness < 0) {
      this.cancelMining();
      return;
    }

    this.miningTime += dt;
    const progress = Math.min(1.0, this.miningTime / this.miningBreakTime);
    const now = performance.now();

    // 1. play dig sound (throttle: 250ms)
    if (now - this.lastDigSoundTime > 250) {
      this.lastDigSoundTime = now;
      sound.playClick();
    }

    // 2. spawn minor particles (throttle: 120ms)
    if (now - this.lastDigParticleTime > 120) {
      this.lastDigParticleTime = now;
      const color = BLOCK_COLORS[blockId] ?? 0x787878;
      this.particles.spawn(
        new THREE.Vector3(
          target.x + 0.2 + Math.random() * 0.6,
          target.y + 0.2 + Math.random() * 0.6,
          target.z + 0.2 + Math.random() * 0.6
        ),
        color,
        2
      );
    }

    // 3. update 3D crack mesh overlay
    if (props.showBreakCracks !== false) {
      this.crackMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
      const stage = Math.min(9, Math.floor(progress * 10));
      const mat = this.crackMesh.material as THREE.MeshBasicMaterial;
      mat.map = this.crackTextures[stage];
      this.crackMesh.visible = true; // 正确设置网格本身为显示状态
    } else {
      this.crackMesh.visible = false;
    }

    // 4. update HUD progress circle directly via DOM
    const circle = document.getElementById('mining-progress-circle');
    const svg = circle?.parentElement as HTMLElement | null;
    if (svg) svg.style.display = 'block';
    if (circle) {
      const offset = 100 - (progress * 100);
      circle.setAttribute('stroke-dashoffset', offset.toString());
    }

    // 5. break target block if progress is finished
    if (this.miningTime >= this.miningBreakTime) {
      this.world.setBlock(target.x, target.y, target.z, BLOCK_TYPES.AIR);
      sound.playBreak();

      // spawn major particles
      const color = BLOCK_COLORS[blockId] ?? 0x787878;
      this.particles.spawn(
        new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5),
        color,
        15
      );

      this.cancelMining();
    }
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  // Perform a custom stepping raycast to find targeted block
  private updateTargetedBlock() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const dir = raycaster.ray.direction;
    const origin = raycaster.ray.origin;

    const maxDist = 5.2;
    const step = 0.04;
    const current = origin.clone();

    this.targetedBlockInfo = null;
    this.selectionBox.visible = false;

    for (let d = 0; d < maxDist; d += step) {
      current.addScaledVector(dir, step);
      const bx = Math.floor(current.x);
      const by = Math.floor(current.y);
      const bz = Math.floor(current.z);

      const blockType = this.world.getBlock(bx, by, bz);
      const props = getBlockProperties(blockType);
      // We can only target non-air, non-liquid blocks (solid blocks and transparent glass)
      if (blockType !== BLOCK_TYPES.AIR && !props.isLiquid) {
        // Calculate block coordinate to place (previous step position)
        const prev = current.clone().addScaledVector(dir, -step);
        const px = Math.floor(prev.x);
        const py = Math.floor(prev.y);
        const pz = Math.floor(prev.z);

        this.targetedBlockInfo = {
          target: new THREE.Vector3(bx, by, bz),
          place: new THREE.Vector3(px, py, pz),
        };

        // Align selection box
        this.selectionBox.position.set(bx + 0.5, by + 0.5, bz + 0.5);
        this.selectionBox.visible = true;
        break;
      }
    }
  }

  // Handle day/night cycles
  private updateDayNight(dt: number) {
    this.gameTime = (this.gameTime + dt) % this.dayDuration;
    const t = this.gameTime / this.dayDuration; // 0 to 1

    // Angle of the sun/moon
    const angle = t * Math.PI * 2;
    
    // Position sun
    this.dirLight.position.set(
      Math.sin(angle) * 80,
      Math.cos(angle) * 80,
      15
    );

    // Calculate light intensities and colors based on time
    // Noon is at t = 0.25 (gameTime = 60), midnight is at t = 0.75 (gameTime = 180)
    // Height > 0 is day, Height < 0 is night
    const sunAltitude = Math.sin(angle); // 1 at noon (t=0.25), -1 at midnight (t=0.75)

    let skyColor: THREE.Color;
    let fogColor: THREE.Color;
    let lightColor: THREE.Color;
    let intensity: number;

    if (sunAltitude > 0.1) {
      // Day
      const blend = (sunAltitude - 0.1) / 0.9;
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0xfb9062), new THREE.Color(0x7ec0ee), blend); // Orange-pink to Sky blue
      fogColor = skyColor.clone();
      lightColor = new THREE.Color(0xffffff);
      intensity = 1.0 + blend * 0.4;
      this.hemiLight.intensity = 0.5 + blend * 0.2;
    } else if (sunAltitude < -0.1) {
      // Night
      const blend = (-sunAltitude - 0.1) / 0.9;
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0x191932), new THREE.Color(0x0a0a14), blend); // Sunset to Space
      fogColor = skyColor.clone();
      lightColor = new THREE.Color(0xaabbff); // Moonlight tint
      intensity = 0.2;
      this.hemiLight.intensity = 0.15;
    } else {
      // Sunset/Sunrise transition (-0.1 to 0.1)
      const blend = (sunAltitude + 0.1) / 0.2; // 0 (night) to 1 (day)
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0x0e0e20), new THREE.Color(0xfb9062), blend);
      fogColor = skyColor.clone();
      lightColor = new THREE.Color().lerpColors(new THREE.Color(0xffaa66), new THREE.Color(0xffffff), blend);
      intensity = 0.2 + blend * 0.8;
      this.hemiLight.intensity = 0.15 + blend * 0.35;
    }

    // Apply lighting and backgrounds
    this.renderer.setClearColor(skyColor);
    this.scene.background = skyColor;
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color.copy(fogColor);
    }

    this.dirLight.intensity = intensity;
    this.dirLight.color.copy(lightColor);
  }

  // Animation frame loop
  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Avoid massive jumps if page is out of focus
    if (dt > 0.15) dt = 0.15;

    // Update FPS Counter
    this.fpsCounter.update();

    // Update particle pool
    if (this.particles) {
      this.particles.update(dt);
    }

    // Skip update if not locked/paused
    if (this.controls.isLocked) {
      // Day-Night calculation
      this.updateDayNight(dt);

      // Apply underwater fog overlay if player is in water
      if (this.player.state.inWater) {
        const waterColor = new THREE.Color(0x1030a0);
        this.renderer.setClearColor(waterColor);
        this.scene.background = waterColor;
        if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
          this.scene.fog.color.copy(waterColor);
          this.scene.fog.density = 0.08;
        }
      } else {
        if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
          this.scene.fog.density = 0.015;
        }
      }

      // Update player positions, resolve collisions, update camera
      this.player.update(dt, this.physics, this.controls, this.world);

      // Dynamically load terrain chunks around player
      this.world.loadArea(this.player.position.x, this.player.position.z, this.renderDistance);

      // Trace targeting selection outline
      this.updateTargetedBlock();

      // Update Mining progress
      this.updateMining(dt);

      // UI update throttling (100ms)
      const now = performance.now();
      if (now - this.lastUiUpdateTime > 100) {
        this.lastUiUpdateTime = now;
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
    }

    // Render 3D world
    this.renderer.render(this.scene, this.camera);
  };

  public setRenderDistance(dist: number) {
    this.renderDistance = dist;
    // Force immediate reload of area
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
    return {
      fps: this.fpsCounter.getFPS(),
      chunksLoaded: this.world.group.children.length / 2, // 2 meshes per chunk
      isFlying: this.player.isFlying,
      targetBlock: this.targetedBlockInfo
        ? {
            type: this.getBlockName(
              this.world.getBlock(
                this.targetedBlockInfo.target.x,
                this.targetedBlockInfo.target.y,
                this.targetedBlockInfo.target.z
              )
            ),
            x: this.targetedBlockInfo.target.x,
            y: this.targetedBlockInfo.target.y,
            z: this.targetedBlockInfo.target.z,
          }
        : null,
    };
  }

  public dispose() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);

    if (this.controls) this.controls.dispose();
    if (this.world) this.world.dispose();
    if (this.renderer) this.renderer.dispose();

    // Clean up textures and mesh
    if (this.crackTextures) {
      this.crackTextures.forEach((tex) => tex.dispose());
    }
    if (this.crackMesh) {
      this.scene.remove(this.crackMesh);
      if (this.crackMesh.geometry) this.crackMesh.geometry.dispose();
      if (Array.isArray(this.crackMesh.material)) {
        this.crackMesh.material.forEach((mat: THREE.Material) => mat.dispose());
      } else if (this.crackMesh.material) {
        (this.crackMesh.material as THREE.Material).dispose();
      }
    }
  }
}
