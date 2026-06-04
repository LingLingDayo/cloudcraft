import * as THREE from 'three';
import { World } from '@game/world/World';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';

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
    const halfW = this.width / 2;
    const halfD = this.depth / 2;
    return new THREE.Box3(
      new THREE.Vector3(pos.x - halfW, pos.y, pos.z - halfD),
      new THREE.Vector3(pos.x + halfW, pos.y + this.height, pos.z + halfD)
    );
  }

  private getCollidingBlocks(box: THREE.Box3): { x: number; y: number; z: number }[] {
    const colliders = [];
    const minX = Math.floor(box.min.x);
    const maxX = Math.floor(box.max.x);
    const minY = Math.floor(box.min.y);
    const maxY = Math.floor(box.max.y);
    const minZ = Math.floor(box.min.z);
    const maxZ = Math.floor(box.max.z);

    const eps = 1e-4;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = this.world.getBlock(x, y, z);
          const props = getBlockProperties(id);
          const isCollidable = props.isCollidable ?? props.isSolid;
          if (isCollidable) {
            const isIntersect = (
              box.min.x + eps < x + 1 &&
              box.max.x - eps > x &&
              box.min.y + eps < y + 1 &&
              box.max.y - eps > y &&
              box.min.z + eps < z + 1 &&
              box.max.z - eps > z
            );
            if (isIntersect) {
              colliders.push({ x, y, z });
            }
          }
        }
      }
    }
    return colliders;
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

    // Move along X
    this.position.x += this.velocity.x * dt;
    let box = this.getBoundingBox();
    let colliders = this.getCollidingBlocks(box);
    let collidedX = false;
    for (const block of colliders) {
      const overlapX = Math.min(box.max.x - block.x, block.x + 1 - box.min.x);
      if (overlapX > 0) {
        if (this.velocity.x > 0) this.position.x -= overlapX;
        else if (this.velocity.x < 0) this.position.x += overlapX;
        this.velocity.x = 0;
        collidedX = true;
        box = this.getBoundingBox();
      }
    }

    // Move along Z
    this.position.z += this.velocity.z * dt;
    box = this.getBoundingBox();
    colliders = this.getCollidingBlocks(box);
    let collidedZ = false;
    for (const block of colliders) {
      const overlapZ = Math.min(box.max.z - block.z, block.z + 1 - box.min.z);
      if (overlapZ > 0) {
        if (this.velocity.z > 0) this.position.z -= overlapZ;
        else if (this.velocity.z < 0) this.position.z += overlapZ;
        this.velocity.z = 0;
        collidedZ = true;
        box = this.getBoundingBox();
      }
    }

    // Step-up jump check: if animal hits a wall horizontally, try to jump
    if (this.state.onGround && (collidedX || collidedZ)) {
      // Check if there is block blocking front at knee height
      const dx = Math.sign(this.velocity.x || this.targetDir.x);
      const dz = Math.sign(this.velocity.z || this.targetDir.z);
      const checkX = Math.floor(this.position.x + dx * 0.45);
      const checkY = Math.floor(this.position.y);
      const checkZ = Math.floor(this.position.z + dz * 0.45);

      const blockHead = this.world.getBlock(checkX, checkY + 1, checkZ);
      // If head-level space is free, jump to get over it
      if (getBlockProperties(blockHead).id === BLOCK_TYPES.AIR) {
        this.shouldJump = true;
      }
    }

    // Move along Y
    this.position.y += this.velocity.y * dt;
    box = this.getBoundingBox();
    colliders = this.getCollidingBlocks(box);
    this.state.onGround = false;
    for (const block of colliders) {
      const overlapY = Math.min(box.max.y - block.y, block.y + 1 - box.min.y);
      if (overlapY > 0) {
        if (this.velocity.y > 0) {
          this.position.y -= overlapY;
          this.velocity.y = 0;
        } else if (this.velocity.y < 0) {
          this.position.y += overlapY;
          this.velocity.y = 0;
          this.state.onGround = true;
        }
        box = this.getBoundingBox();
      }
    }

    // Avoid falling into void
    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.state.onGround = true;
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
    this.dropItems();
  }
}
