import * as THREE from 'three';
import { World } from '@game/world/World';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';
import { VoxelPhysics } from '@game/physics/voxel/VoxelPhysics';
import { sound } from '@game/systems/Sound';

export abstract class Animal {
  public id: string;
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public state = { onGround: false, inWater: false };
  
  public life: number;
  public maxLife: number;
  public isDead = false;

  // Physical size
  public abstract width: number;
  public abstract height: number;
  public abstract depth: number;

  // AI & Behavior State
  public aiState: 'wandering' | 'panicked' = 'wandering';
  protected aiTimer = 0;
  protected targetDir = new THREE.Vector3();
  protected shouldJump = false;

  // Visuals
  public mesh: THREE.Group;
  protected hurtTimer = 0;
  protected forwardRotationOffset = Math.PI; // Three.js forward is -Z, offset alignment by 180 degrees

  // Speed configs
  protected abstract walkSpeed: number;
  protected abstract panicSpeed: number;
  protected abstract jumpSpeed: number;

  // Sound keys
  public abstract hurtSound: string;
  public abstract deathSound: string;

  protected world: World;

  constructor(id: string, spawnPos: THREE.Vector3, world: World, maxLife = 10) {
    this.id = id;
    this.position.copy(spawnPos);
    this.world = world;
    this.maxLife = maxLife;
    this.life = maxLife;
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);
  }

  public abstract initMesh(): void;
  
  public abstract dropItems(): void;

  public getBoundingBox(pos = this.position): THREE.Box3 {
    return VoxelPhysics.getBoundingBox(pos, { width: this.width, height: this.height, depth: this.depth });
  }

  public checkInWater(): boolean {
    const blockBottom = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
    return getBlockProperties(blockBottom).isLiquid;
  }

  public update(dt: number) {
    if (this.isDead) return;

    // 1. Process damage flashing visual timer
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) {
        this.resetHurtVisual();
      }
    }

    // 2. Update AI Decisions
    this.updateAI(dt);

    // 3. Update Physics & Movements
    this.updatePhysics(dt);

    // 4. Update model position & orientation
    this.mesh.position.copy(this.position);
    this.updateRotation(dt);
  }

  protected updateAI(dt: number) {
    this.aiTimer -= dt;

    if (this.aiState === 'panicked') {
      if (this.aiTimer <= 0) {
        this.aiState = 'wandering';
        this.aiTimer = Math.random() * 3 + 2; // Wander interval
      } else {
        // Change run direction occasionally
        if (Math.random() < 0.05) {
          const angle = Math.random() * Math.PI * 2;
          this.targetDir.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
        }
      }
    } else {
      // Wandering state
      if (this.aiTimer <= 0) {
        const rand = Math.random();
        if (rand < 0.6) {
          // Walk
          const angle = Math.random() * Math.PI * 2;
          this.targetDir.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
          this.aiTimer = Math.random() * 3 + 2;
        } else {
          // Idle / Stand still
          this.targetDir.set(0, 0, 0);
          this.aiTimer = Math.random() * 2 + 1;
        }
      }
    }
  }

  protected updatePhysics(dt: number) {
    dt = Math.min(dt, 0.1);
    const gravity = -18;
    const terminalVelocity = -22;

    this.state.inWater = this.checkInWater();

    // Apply horizontal speed forces
    const speed = this.aiState === 'panicked' ? this.panicSpeed : this.walkSpeed;
    this.velocity.x = this.targetDir.x * speed;
    this.velocity.z = this.targetDir.z * speed;

    // Apply vertical forces (Gravity / Float buoyancy)
    if (this.state.inWater) {
      if (this.shouldJump || Math.random() < 0.1) {
        // Animals automatically swim up when stuck in water
        this.velocity.y = 2.0;
        this.shouldJump = false;
      } else {
        this.velocity.y = Math.max(-1.0, this.velocity.y - 4.0 * dt);
      }
    } else if (!this.state.onGround) {
      this.velocity.y += gravity * dt;
      this.velocity.y = Math.max(terminalVelocity, this.velocity.y);
    } else {
      this.velocity.y = 0;
      if (this.shouldJump) {
        this.velocity.y = this.jumpSpeed;
        this.state.onGround = false;
        this.shouldJump = false;
      }
    }

    // Record pre-collision horizontal movement indicators for step-up jump check
    const velXBefore = this.velocity.x;
    const velZBefore = this.velocity.z;

    // Delegate movement and collision resolution to VoxelPhysics.resolveMove
    const { collidedX, collidedZ, onGround } = VoxelPhysics.resolveMove(
      this.world,
      this.position,
      this.velocity,
      { width: this.width, height: this.height, depth: this.depth },
      dt
    );

    this.state.onGround = onGround;

    // Step-up jump check: if animal hits a wall horizontally, try to jump
    if (this.state.onGround && (collidedX || collidedZ)) {
      // Check if there is block blocking front at knee height
      const dx = Math.sign(velXBefore || this.targetDir.x);
      const dz = Math.sign(velZBefore || this.targetDir.z);
      const checkX = Math.floor(this.position.x + dx * 0.45);
      const checkY = Math.floor(this.position.y);
      const checkZ = Math.floor(this.position.z + dz * 0.45);

      const blockHead = this.world.getBlock(checkX, checkY + 1, checkZ);
      // If head-level space is free, jump to get over it
      if (getBlockProperties(blockHead).id === BLOCK_TYPES.AIR) {
        this.shouldJump = true;
      }
    }
  }

  protected updateRotation(dt: number) {
    if (this.velocity.x !== 0 || this.velocity.z !== 0) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z) + this.forwardRotationOffset;
      let diff = targetAngle - this.mesh.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.mesh.rotation.y += diff * dt * 8.0;
    }
  }

  public takeDamage(amount: number) {
    if (this.isDead) return;

    this.life = Math.max(0, this.life - amount);
    this.aiState = 'panicked';
    this.aiTimer = 5.0; // Panic for 5s
    
    // Choose panic direction away from current velocity or randomly
    const angle = Math.random() * Math.PI * 2;
    this.targetDir.set(Math.sin(angle), 0, Math.cos(angle)).normalize();

    this.triggerHurtVisual();

    if (this.hurtSound) {
      if (typeof sound.play === 'function') {
        sound.play(this.hurtSound);
      } else {
        const fallbackFn = (sound as unknown as Record<string, unknown>)[this.hurtSound];
        if (typeof fallbackFn === 'function') {
          fallbackFn.call(sound);
        }
      }
    }

    if (this.life <= 0) {
      this.die();
    }
  }

  protected triggerHurtVisual() {
    this.hurtTimer = 0.2; // Flash red for 200ms
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat && 'emissive' in mat) {
            mat.emissive.setHex(0xff0000);
            mat.emissiveIntensity = 0.6;
          }
        });
      }
    });
  }

  protected resetHurtVisual() {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat && 'emissive' in mat) {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        });
      }
    });
  }

  protected die() {
    this.isDead = true;
    this.resetHurtVisual();
    if (this.deathSound) {
      if (typeof sound.play === 'function') {
        sound.play(this.deathSound);
      } else {
        const fallbackFn = (sound as unknown as Record<string, unknown>)[this.deathSound];
        if (typeof fallbackFn === 'function') {
          fallbackFn.call(sound);
        }
      }
    }
    this.dropItems();
  }
}
