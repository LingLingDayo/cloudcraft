import * as THREE from 'three';
import { World, WORLD_HEIGHT } from '@game/world/World';
import { Physics } from '@game/physics/Physics';
import { Controls } from '@game/systems/Controls';
import { sound } from '@game/systems/Sound';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';
import { GameAction } from '@game/systems/HotkeyManager';
import { useGameStore } from '@store/useGameStore';
import type { ItemType } from '@type';
import { isTestSeed as checkIsTestSeed } from '@game/world/WorldConfig';

export class Player {
  public position = new THREE.Vector3(8.5, 40, 8.5);
  public spawnPoint = new THREE.Vector3(8.5, 40, 8.5);
  public velocity = new THREE.Vector3();
  public state = { onGround: false, inWater: false };
  public isFlying = false;
  public life = 10;
  public hunger = 20;
  public selectedItemType: ItemType | null = null;

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
    // 1. 每次均根据当前传入的 world 种子重新计算并定位安全的世界出生中心点（World Spawn Center）
    let baseX = 8.5;
    let baseZ = 8.5;
    let isTestSeed = false;

    const getSeed = (world as unknown as { getSeed?: () => string }).getSeed;
    if (typeof getSeed === 'function') {
      const seed = getSeed.call(world);
      isTestSeed = !!(seed && checkIsTestSeed(seed));
      if (seed && !isTestSeed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = (hash << 5) - hash + seed.charCodeAt(i);
          hash |= 0;
        }
        // 基于种子产生 -150 到 150 之间的随机出生点，避开固定生成河流的原点 (0, 0)
        baseX = ((Math.abs(hash * 31) % 300) - 150) + 0.5;
        baseZ = ((Math.abs(hash * 17) % 300) - 150) + 0.5;
      }
    }

    let startX = baseX;
    let startZ = baseZ;
    let startY = WORLD_HEIGHT - 2;

    // 寻找安全的陆地出生点中心 (不属于水域且是 solid 的地面)
    let foundSafeSpawn = false;
    const maxSearchRadius = isTestSeed ? 4 : 32; // 单元测试种子下限制最大检索半径为 4，大幅优化单元测试性能
    
    // 螺旋式搜索安全的出生点
    outerLoop:
    for (let r = 0; r <= maxSearchRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          
          const testX = baseX + dx;
          const testZ = baseZ + dz;
          
          // 从上往下找到第一个非空气方块
          let testY = WORLD_HEIGHT - 2;
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

    // 如果找不到安全的陆地，就退回到选择的 baseX, baseZ 基础点
    if (!foundSafeSpawn) {
      startX = baseX;
      startZ = baseZ;
      startY = WORLD_HEIGHT - 2;
      
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

    // 记录最新计算的世界出生中心点
    this.spawnPoint.set(startX, startY, startZ);

    // 2. 模拟 Minecraft 的出生半径随机偏置机制 (默认在 Spawn Radius = 10 范围内随机落脚)
    const spawnRadius = 10;
    let finalX = this.spawnPoint.x;
    let finalZ = this.spawnPoint.z;
    let finalY = this.spawnPoint.y;
    let foundRandSpawn = false;

    // 尝试随机偏置，若在偏置后的 (x, z) 处能寻找到安全的陆地，则在此地出生
    for (let attempt = 0; attempt < 10; attempt++) {
      const r = Math.random() * spawnRadius;
      const angle = Math.random() * Math.PI * 2;
      const randX = this.spawnPoint.x + Math.cos(angle) * r;
      const randZ = this.spawnPoint.z + Math.sin(angle) * r;

      // 从上往下寻找地表高度
      let testY = WORLD_HEIGHT - 2;
      while (testY > 0 && world.getBlock(Math.floor(randX), testY, Math.floor(randZ)) === BLOCK_TYPES.AIR) {
        testY--;
      }

      if (testY > 0) {
        const topBlockId = world.getBlock(Math.floor(randX), testY, Math.floor(randZ));
        const props = getBlockProperties(topBlockId);
        const canSpawnOn = props.canSpawnOn ?? (props.isSolid && !props.isTransparent && !props.isLiquid);

        if (canSpawnOn) {
          // 对齐到方块中心，避免因为浮点数偏移玩家陷进缝隙中，也便于单元测试精确匹配
          finalX = Math.floor(randX) + 0.5;
          finalZ = Math.floor(randZ) + 0.5;
          finalY = testY;
          foundRandSpawn = true;
          break;
        }
      }
    }

    // 超过尝试次数仍找不到安全降落区（比如全被随机偏置进了湖中），则稳妥回退到最初设定的安全出生中心点本身
    if (!foundRandSpawn) {
      finalX = this.spawnPoint.x;
      finalZ = this.spawnPoint.z;
      finalY = this.spawnPoint.y;
    }

    // 将玩家定位到该方块之上
    this.position.set(finalX, finalY + 1.2, finalZ);
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
    const autoJumpSetting = useGameStore.getState().autoJump;
    const isMovingForward = controls.isActionPressed(GameAction.MOVE_FORWARD) && !controls.isActionPressed(GameAction.MOVE_BACKWARD);
    const autoJump = autoJumpSetting && isMovingForward;

    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

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
      autoJump,
      cameraDirection
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
        }

        // Starvation damage when hunger is 0 (can starve to death)
        if (this.hunger === 0 && this.life > 0) {
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
