import * as THREE from 'three';
import { World, CHUNK_SIZE_Y } from '@game/world/World';
import { Physics } from '@game/physics/Physics';
import { Controls } from '@game/systems/Controls';
import { sound } from '@game/systems/Sound';
import { BLOCK_TYPES, type BlockType, getBlockProperties } from '@game/world/BlockConfig';
import { GameAction } from '@game/systems/HotkeyManager';
import { useGameStore } from '@store/useGameStore';

export class Player {
  public position = new THREE.Vector3(8.5, 40, 8.5);
  public spawnPoint = new THREE.Vector3(8.5, 40, 8.5);
  public velocity = new THREE.Vector3();
  public state = { onGround: false, inWater: false };
  public isFlying = false;
  public life = 10;
  public hunger = 20;
  public selectedBlockType: BlockType = BLOCK_TYPES.GRASS;

  private camera: THREE.PerspectiveCamera;
  private onTakeDamage?: () => void;
  private lastJumpPressed = false;
  private lastJumpTime = 0;
  private doubleJumpDelay = 0.25; // 250ms
  private voidDamageTimer = 0;
  private hungerExhaustion = 0;
  private hungerTimer = 0;

  constructor(camera: THREE.PerspectiveCamera, onTakeDamage?: () => void) {
    this.camera = camera;
    this.onTakeDamage = onTakeDamage;
  }

  public spawn(world: World, _physics: Physics) {
    let startX = 8.5;
    let startZ = 8.5;
    let startY = CHUNK_SIZE_Y - 2;

    // 寻找安全的陆地出生点 (不属于水域且是 solid 的地面)
    let foundSafeSpawn = false;
    const maxSearchRadius = 16; // 寻找范围：16格以内 (优化查找性能)
    
    // 螺旋式搜索安全的出生点
    outerLoop:
    for (let r = 0; r <= maxSearchRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          
          const testX = 8.5 + dx;
          const testZ = 8.5 + dz;
          
          // 从上往下找到第一个非空气方块
          let testY = CHUNK_SIZE_Y - 2;
          while (testY > 0 && world.getBlock(Math.floor(testX), testY, Math.floor(testZ)) === BLOCK_TYPES.AIR) {
            testY--;
          }
          
          if (testY > 0) {
            const topBlockId = world.getBlock(Math.floor(testX), testY, Math.floor(testZ));
            const props = getBlockProperties(topBlockId);
            const canSpawnOn = props.canSpawnOn ?? (props.isSolid && !props.isTransparent && !props.isLiquid);
                          
            if (canSpawnOn) {
              startX = testX;
              startZ = testZ;
              startY = testY;
              foundSafeSpawn = true;
              break outerLoop;
            }
          }
        }
      }
    }

    // 如果找不到安全的陆地，就退回到默认的 (8.5, 8.5)
    if (!foundSafeSpawn) {
      startX = 8.5;
      startZ = 8.5;
      startY = CHUNK_SIZE_Y - 2;
      
      // 仍然向下寻路，但如果碰到水或者普通 Solid，就停下来（即 props.isSolid || props.isLiquid）
      while (startY > 0) {
        const blockId = world.getBlock(Math.floor(startX), startY, Math.floor(startZ));
        const props = getBlockProperties(blockId);
        if (props.isSolid || props.isLiquid) {
          break;
        }
        startY--;
      }
    }

    // 将玩家定位到该方块之上
    this.position.set(startX, startY + 1.2, startZ);
    this.spawnPoint.set(startX, startY, startZ);
    this.velocity.set(0, 0, 0);
    this.state.onGround = false;
    this.syncCamera();
  }

  public update(dt: number, physics: Physics, controls: Controls, world: World) {
    const isCreative = useGameStore.getState().gameMode === 'creative';

    // Reset flying state if not in creative mode
    if (!isCreative && this.isFlying) {
      this.isFlying = false;
    }

    const inputDirection = controls.getMovementDirection();
    const isJumping = controls.isActionPressed(GameAction.JUMP);

    // Double-click jump to toggle flying (Creative mode only)
    if (isCreative) {
      const jumpJustPressed = isJumping && !this.lastJumpPressed;
      if (jumpJustPressed) {
        const now = performance.now() / 1000;
        if (now - this.lastJumpTime < this.doubleJumpDelay) {
          this.isFlying = !this.isFlying;
          sound.playClick();
          this.lastJumpTime = 0;
        } else {
          this.lastJumpTime = now;
        }
      }
    }
    this.lastJumpPressed = isJumping;

    const canJump = this.state.onGround && !this.state.inWater && !this.isFlying;
    const wasYVelocity = this.velocity.y;
    const autoJump = useGameStore.getState().autoJump;

    // Update positions, resolve collisions
    physics.update(
      this.position,
      this.velocity,
      dt,
      inputDirection,
      isJumping,
      controls.isActionPressed(GameAction.SNEAK),
      this.isFlying,
      this.state,
      autoJump
    );

    // Play jump sound
    if (canJump && this.velocity.y === physics.jumpSpeed) {
      sound.playJump();
    }

    // Apply fall damage
    if (
      this.state.onGround &&
      wasYVelocity < -14.0 &&
      !this.isFlying &&
      !this.state.inWater &&
      !isCreative
    ) {
      const damage = Math.max(1, Math.floor((-wasYVelocity - 12.0) * 0.7));
      this.takeDamage(damage, world, physics);
    }

    // Apply void damage
    if (this.position.y < 0 && !isCreative) {
      this.voidDamageTimer += dt;
      if (this.voidDamageTimer >= 0.5) {
        this.takeDamage(2, world, physics);
        this.voidDamageTimer = 0;
      }
    } else {
      this.voidDamageTimer = 0;
    }

    // Hunger system update
    if (isCreative) {
      this.hunger = 20;
      this.hungerExhaustion = 0;
    } else {
      // 1. Calculate exhaustion based on actions
      let deltaExhaustion = 0.003 * dt; // Base very slow decay over time

      const isMoving = inputDirection.lengthSq() > 0.01;
      if (isMoving && this.state.onGround && !this.isFlying) {
        const isSprinting = controls.isActionPressed(GameAction.SNEAK); // Shift is sprint in this game!
        if (isSprinting) {
          deltaExhaustion += 0.15 * dt; // Running fast decay
        } else {
          deltaExhaustion += 0.04 * dt; // Walking slow decay
        }
      }

      // Add exhaustion for jumping
      const justJumped = canJump && this.velocity.y === physics.jumpSpeed;
      if (justJumped) {
        const isSprinting = controls.isActionPressed(GameAction.SNEAK);
        deltaExhaustion += isSprinting ? 0.3 : 0.1;
      }

      this.hungerExhaustion += deltaExhaustion;

      // 2. Consume hunger points when exhaustion exceeds 4.0
      if (this.hungerExhaustion >= 4.0) {
        this.hunger = Math.max(0, this.hunger - 1);
        this.hungerExhaustion -= 4.0;
      }

      // 3. Health regeneration & Starvation damage ticks
      this.hungerTimer += dt;
      if (this.hungerTimer >= 4.0) {
        this.hungerTimer -= 4.0;

        // Health regeneration from food (hunger >= 18 and life < 10)
        if (this.hunger >= 18 && this.life < 10) {
          this.life = Math.min(10, this.life + 1);
          this.hungerExhaustion += 1.5; // Regeneration drains hunger
          if (this.onTakeDamage) this.onTakeDamage(); // Trigger UI/State updates
        }

        // Starvation damage when hunger is 0 (life > 1)
        if (this.hunger === 0 && this.life > 1) {
          this.takeDamage(1, world, physics);
        }
      }
    }

    // Sync camera
    this.syncCamera();
  }

  public takeDamage(amount: number, world: World, physics: Physics) {
    const isCreative = useGameStore.getState().gameMode === 'creative';
    if (isCreative) return;

    this.life = Math.max(0, this.life - amount);
    sound.playDamage();
    if (this.onTakeDamage) this.onTakeDamage();

    if (this.life <= 0) {
      sound.playBreak();
      this.life = 10;
      this.hunger = 20;
      this.spawn(world, physics);
    }
  }

  public syncCamera() {
    this.camera.position.copy(this.position);
    this.camera.position.y += 1.67;
  }
}
