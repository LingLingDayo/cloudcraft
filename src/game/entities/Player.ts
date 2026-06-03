import * as THREE from 'three';
import { World } from '@game/world/World';
import { Physics } from '@game/physics/Physics';
import { Controls } from '@game/systems/Controls';
import { sound } from '@game/systems/Sound';
import { BLOCK_TYPES } from '@game/world/BlockConfig';
import { GameAction } from '@game/systems/HotkeyManager';
import { useGameStore } from '@store/useGameStore';

export class Player {
  public position = new THREE.Vector3(8.5, 40, 8.5);
  public velocity = new THREE.Vector3();
  public state = { onGround: false, inWater: false };
  public isFlying = false;
  public life = 10;
  public selectedBlockType = BLOCK_TYPES.GRASS;

  private camera: THREE.PerspectiveCamera;
  private onTakeDamage?: () => void;
  private lastJumpPressed = false;
  private lastJumpTime = 0;
  private doubleJumpDelay = 0.25; // 250ms

  constructor(camera: THREE.PerspectiveCamera, onTakeDamage?: () => void) {
    this.camera = camera;
    this.onTakeDamage = onTakeDamage;
  }

  public spawn(world: World, physics: Physics) {
    const startX = 8.5;
    const startZ = 8.5;
    let startY = 64 - 2; // CHUNK_SIZE_Y = 64

    // Trace down to find first solid block
    while (
      startY > 0 &&
      !physics.isSolid(world.getBlock(Math.floor(startX), startY, Math.floor(startZ)))
    ) {
      startY--;
    }

    this.position.set(startX, startY + 1.2, startZ);
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

    // Update positions, resolve collisions
    physics.update(
      this.position,
      this.velocity,
      dt,
      inputDirection,
      isJumping,
      controls.isActionPressed(GameAction.SNEAK),
      this.isFlying,
      this.state
    );

    // Play jump sound
    if (isJumping && canJump && this.velocity.y === physics.jumpSpeed) {
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
      this.spawn(world, physics);
    }
  }

  public syncCamera() {
    this.camera.position.copy(this.position);
    this.camera.position.y += 1.6;
  }
}
