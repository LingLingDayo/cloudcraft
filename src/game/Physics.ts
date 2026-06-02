import * as THREE from 'three';
import { World, BLOCK_TYPES } from './World';

export class Physics {
  private world: World;
  public playerSize = { width: 0.6, height: 1.8, depth: 0.6 };
  public gravity = -26; // blocks per second squared
  public terminalVelocity = -50;
  public jumpSpeed = 8.5;
  public walkSpeed = 6.0;
  public swimSpeed = 3.0;

  constructor(world: World) {
    this.world = world;
  }

  // A block is solid if it is not AIR and not WATER
  public isSolid(blockId: number): boolean {
    return blockId !== BLOCK_TYPES.AIR && blockId !== BLOCK_TYPES.WATER;
  }

  // Get bounding box of the player
  public getPlayerBox(position: THREE.Vector3): THREE.Box3 {
    const halfW = this.playerSize.width / 2;
    const halfD = this.playerSize.depth / 2;
    return new THREE.Box3(
      new THREE.Vector3(position.x - halfW, position.y, position.z - halfD),
      new THREE.Vector3(position.x + halfW, position.y + this.playerSize.height, position.z + halfD)
    );
  }

  // Get all solid blocks that intersect the bounding box
  private getCollidingBlocks(box: THREE.Box3): { x: number; y: number; z: number; id: number }[] {
    const colliders = [];
    const minX = Math.floor(box.min.x);
    const maxX = Math.floor(box.max.x);
    const minY = Math.floor(box.min.y);
    const maxY = Math.floor(box.max.y);
    const minZ = Math.floor(box.min.z);
    const maxZ = Math.floor(box.max.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = this.world.getBlock(x, y, z);
          if (this.isSolid(id)) {
            colliders.push({ x, y, z, id });
          }
        }
      }
    }
    return colliders;
  }

  // Check if player is in water
  public checkInWater(position: THREE.Vector3): boolean {
    const blockBottom = this.world.getBlock(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
    const blockEye = this.world.getBlock(Math.floor(position.x), Math.floor(position.y + 1.5), Math.floor(position.z));
    return blockBottom === BLOCK_TYPES.WATER || blockEye === BLOCK_TYPES.WATER;
  }

  public update(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    dt: number,
    inputDirection: THREE.Vector3,
    isJumping: boolean,
    state: { onGround: boolean; inWater: boolean }
  ) {
    // Limit dt to prevent huge physics steps (e.g. during lag spikes)
    dt = Math.min(dt, 0.1);

    // 1. Check if in water
    state.inWater = this.checkInWater(position);

    // 2. Apply movement forces
    const speed = state.inWater ? this.swimSpeed : this.walkSpeed;
    velocity.x = inputDirection.x * speed;
    velocity.z = inputDirection.z * speed;

    // 3. Apply gravity & swimming buoyancy
    if (state.inWater) {
      if (isJumping) {
        velocity.y = 3.0; // Swim upwards
      } else {
        // Slow sink in water
        velocity.y = Math.max(-2, velocity.y + this.gravity * 0.15 * dt);
      }
    } else {
      // Normal gravity
      if (!state.onGround) {
        velocity.y += this.gravity * dt;
        velocity.y = Math.max(this.terminalVelocity, velocity.y);
      } else {
        velocity.y = 0;
      }

      // Jump
      if (isJumping && state.onGround) {
        velocity.y = this.jumpSpeed;
        state.onGround = false;
      }
    }

    // 4. Resolve collisions axis by axis
    // Move along X
    position.x += velocity.x * dt;
    let box = this.getPlayerBox(position);
    let colliders = this.getCollidingBlocks(box);
    for (const block of colliders) {
      const overlapX = Math.min(box.max.x - block.x, block.x + 1 - box.min.x);
      if (overlapX > 0) {
        if (velocity.x > 0) {
          position.x -= overlapX;
        } else if (velocity.x < 0) {
          position.x += overlapX;
        }
        velocity.x = 0;
        box = this.getPlayerBox(position);
      }
    }

    // Move along Z
    position.z += velocity.z * dt;
    box = this.getPlayerBox(position);
    colliders = this.getCollidingBlocks(box);
    for (const block of colliders) {
      const overlapZ = Math.min(box.max.z - block.z, block.z + 1 - box.min.z);
      if (overlapZ > 0) {
        if (velocity.z > 0) {
          position.z -= overlapZ;
        } else if (velocity.z < 0) {
          position.z += overlapZ;
        }
        velocity.z = 0;
        box = this.getPlayerBox(position);
      }
    }

    // Move along Y
    position.y += velocity.y * dt;
    box = this.getPlayerBox(position);
    colliders = this.getCollidingBlocks(box);
    
    state.onGround = false;
    for (const block of colliders) {
      const overlapY = Math.min(box.max.y - block.y, block.y + 1 - box.min.y);
      if (overlapY > 0) {
        if (velocity.y > 0) {
          // Hit ceiling
          position.y -= overlapY;
          velocity.y = 0;
        } else if (velocity.y < 0) {
          // Land on ground
          position.y += overlapY;
          velocity.y = 0;
          state.onGround = true;
        }
        box = this.getPlayerBox(position);
      }
    }

    // Extra ground check (in case player is standing perfectly on edge)
    if (!state.onGround && !state.inWater) {
      const testBox = this.getPlayerBox(position);
      testBox.min.y -= 0.01;
      testBox.max.y = testBox.min.y + 0.02;
      const groundBlocks = this.getCollidingBlocks(testBox);
      if (groundBlocks.length > 0) {
        state.onGround = true;
      }
    }
  }
}
