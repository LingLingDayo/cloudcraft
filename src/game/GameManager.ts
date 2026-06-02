import * as THREE from 'three';
import { World, BLOCK_TYPES, CHUNK_SIZE_Y } from './World';
import { Physics } from './Physics';
import { Controls } from './Controls';
import { sound } from './Sound';
import { FPSCounter } from './FPSCounter';
import { ParticleSystem } from './Particles';
import type { DebugMetrics } from '../types';

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

  private canvas: HTMLCanvasElement;
  private animationId: number | null = null;
  private lastTime = 0;

  // Player properties
  public playerPosition = new THREE.Vector3(8.5, 40, 8.5);
  public playerVelocity = new THREE.Vector3();
  public playerState = { onGround: false, inWater: false };
  public selectedBlockType = BLOCK_TYPES.GRASS;
  public life = 10;
  
  // Game state UI callbacks
  private onPauseStateChange: (paused: boolean) => void;
  private onDebugOverlayToggle?: (visible: boolean) => void;

  // Day-Night cycle properties
  private gameTime = 60; // Start at 60s (noon)
  private dayDuration = 240; // 4 minutes per day
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  // Interaction properties
  private selectionBox!: THREE.Mesh;
  private targetedBlockInfo: { target: THREE.Vector3; place: THREE.Vector3 } | null = null;

  // Settings
  public renderDistance = 3; // radius in chunks

  // Debug metrics & Flight mode
  public isFlying = false;
  public debugOverlayVisible = false;
  public fpsCounter = new FPSCounter();

  // Particles & Damage Hook
  public particles!: ParticleSystem;
  private onTakeDamage?: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    onPauseStateChange: (paused: boolean) => void,
    onDebugOverlayToggle: (visible: boolean) => void,
    onTakeDamage: () => void,
    seed: string = 'minicraft'
  ) {
    this.canvas = canvas;
    this.onPauseStateChange = onPauseStateChange;
    this.onDebugOverlayToggle = onDebugOverlayToggle;
    this.onTakeDamage = onTakeDamage;

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
      this.onPauseStateChange(!locked);
    });

    // Setup F3 & F4 triggers
    this.controls.onF3Pressed = () => {
      this.debugOverlayVisible = !this.debugOverlayVisible;
      sound.playClick();
      if (this.onDebugOverlayToggle) {
        this.onDebugOverlayToggle(this.debugOverlayVisible);
      }
    };

    this.controls.onF4Pressed = () => {
      this.isFlying = !this.isFlying;
      sound.playClick();
    };

    this.particles = new ParticleSystem(this.scene);

    // Spawn player on safe dry ground
    this.spawnPlayer();
  }

  public spawnPlayer() {
    const startX = 8.5;
    const startZ = 8.5;
    let startY = CHUNK_SIZE_Y - 2;

    // Trace down to find first solid block
    while (
      startY > 0 &&
      !this.physics.isSolid(this.world.getBlock(Math.floor(startX), startY, Math.floor(startZ)))
    ) {
      startY--;
    }

    this.playerPosition.set(startX, startY + 1.2, startZ);
    this.playerVelocity.set(0, 0, 0);
    this.playerState.onGround = false;
    this.camera.position.copy(this.playerPosition);
    this.camera.position.y += 1.6; // Eyes height
  }

  private initListeners() {
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
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
      // Left Click: Break Block
      const { target } = this.targetedBlockInfo;
      const blockId = this.world.getBlock(target.x, target.y, target.z);
      if (blockId !== BLOCK_TYPES.AIR && blockId !== BLOCK_TYPES.WATER) {
        this.world.setBlock(target.x, target.y, target.z, BLOCK_TYPES.AIR);
        sound.playBreak();
        
        // Spawn particle blast
        const color = BLOCK_COLORS[blockId] ?? 0x787878;
        this.particles.spawn(
          new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5),
          color,
          15
        );
      }
    } else if (e.button === 2) {
      // Right Click: Place Block
      const { place } = this.targetedBlockInfo;
      
      // Make sure placement doesn't overlap player bounding box
      const blockBox = new THREE.Box3(
        place,
        new THREE.Vector3(place.x + 1, place.y + 1, place.z + 1)
      );
      const playerBox = this.physics.getPlayerBox(this.playerPosition);

      if (!playerBox.intersectsBox(blockBox)) {
        this.world.setBlock(place.x, place.y, place.z, this.selectedBlockType);
        sound.playPlace();

        // Spawn placement dust particles
        const color = BLOCK_COLORS[this.selectedBlockType] ?? 0xffffff;
        this.particles.spawn(
          new THREE.Vector3(place.x + 0.5, place.y + 0.5, place.z + 0.5),
          color,
          8
        );
      }
    }
  };

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
      // We can only target solid blocks or transparent glass (not air or water)
      if (blockType !== BLOCK_TYPES.AIR && blockType !== BLOCK_TYPES.WATER) {
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
      if (this.playerState.inWater) {
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

      // Read movement keyboard inputs
      const inputDirection = this.controls.getMovementDirection();
      const isJumping = this.controls.keys.Space;

      // Check if player is able to jump before physics update
      const canJump = this.playerState.onGround && !this.playerState.inWater && !this.isFlying;

      const wasYVelocity = this.playerVelocity.y;

      // Update player positions, resolve collisions
      this.physics.update(
        this.playerPosition,
        this.playerVelocity,
        dt,
        inputDirection,
        isJumping,
        this.controls.keys.ShiftLeft,
        this.isFlying,
        this.playerState
      );

      // Play jump sound only when a jump is actually triggered
      if (isJumping && canJump && this.playerVelocity.y === this.physics.jumpSpeed) {
        sound.playJump();
      }

      // Apply fall damage
      if (this.playerState.onGround && wasYVelocity < -14.0 && !this.isFlying && !this.playerState.inWater) {
        const damage = Math.max(1, Math.floor((-wasYVelocity - 12.0) * 0.7));
        this.life = Math.max(0, this.life - damage);
        sound.playDamage();
        if (this.onTakeDamage) this.onTakeDamage();

        // Respawn check
        if (this.life <= 0) {
          sound.playBreak();
          this.life = 10;
          this.spawnPlayer();
        }
      }

      // Keep camera aligned at player eye height
      this.camera.position.copy(this.playerPosition);
      this.camera.position.y += 1.6;

      // Dynamically load terrain chunks around player
      this.world.loadArea(this.playerPosition.x, this.playerPosition.z, this.renderDistance);

      // Trace targeting selection outline
      this.updateTargetedBlock();
    }

    // Render 3D world
    this.renderer.render(this.scene, this.camera);
  };

  public setRenderDistance(dist: number) {
    this.renderDistance = dist;
    // Force immediate reload of area
    if (this.world) {
      this.world.loadArea(this.playerPosition.x, this.playerPosition.z, this.renderDistance);
    }
  }

  public setFov(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  private getBlockName(id: number): string {
    const names: Record<number, string> = {
      0: '空气 (Air)',
      1: '草方块 (Grass Block)',
      2: '泥土 (Dirt)',
      3: '石头 (Stone)',
      4: '木头 (Wood)',
      5: '树叶 (Leaves)',
      6: '红砖 (Brick)',
      7: '玻璃 (Glass)',
      8: '水 (Water)',
      9: '沙子 (Sand)',
      10: '煤矿 (Coal Ore)',
      11: '铁矿 (Iron Ore)',
      12: '钻石矿 (Diamond Ore)',
    };
    return names[id] || '未知方块';
  }

  public getDebugMetrics(): DebugMetrics {
    return {
      fps: this.fpsCounter.getFPS(),
      chunksLoaded: this.world.group.children.length / 2, // 2 meshes per chunk
      isFlying: this.isFlying,
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
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);

    if (this.controls) this.controls.dispose();
    if (this.world) this.world.dispose();
    if (this.renderer) this.renderer.dispose();
  }
}
