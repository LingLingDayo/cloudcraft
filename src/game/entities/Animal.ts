import * as THREE from 'three';
import { World } from '@game/world/World';
import { getBlockProperties } from '@game/world/BlockConfig';
import { VoxelCollider } from '@game/physics/voxel/VoxelCollider';
import { sound } from '@game/systems/Sound';
import { LootTableHelper } from '../loot/LootTableHelper';
import { Entity, type EntityExtensionData } from './Entity';
import {
  BehaviorStateMachine,
  type BehaviorStateDefinition,
} from './behavior/BehaviorStateMachine';
import { MovementModeController } from './movement/MovementMode';
import {
  CoreMovementModeId,
  coreMovementModeRegistry,
  type CreatureMovementContext,
} from './movement/CoreMovementModes';

const DEFAULT_MOVEMENT_MODE_IDS = [
  CoreMovementModeId.SWIM,
  CoreMovementModeId.GROUND,
] as const;

export abstract class Animal extends Entity {
  public state = { onGround: false, inWater: false };

  // Physical size
  public abstract width: number;
  public abstract height: number;
  public abstract depth: number;

  // AI & Behavior State
  protected readonly behaviorStateMachine = new BehaviorStateMachine<Animal>();
  protected readonly movementController: MovementModeController<CreatureMovementContext>;
  protected aiTimer = 0;
  protected targetDir = new THREE.Vector3();
  protected shouldJump = false;
  protected flightRequested = false;
  private readonly movementDimensions = { width: 0, height: 0, depth: 0 };
  private readonly movementContext: CreatureMovementContext;

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

  constructor(
    id: string,
    type: string,
    spawnPos: THREE.Vector3,
    world: World,
    maxLife = 10,
    movementModeIds: readonly string[] = DEFAULT_MOVEMENT_MODE_IDS,
  ) {
    super(id, type, spawnPos, world, maxLife);
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);
    this.movementController = new MovementModeController(
      coreMovementModeRegistry,
      movementModeIds,
    );
    this.movementContext = {
      world: this.world,
      position: this.position,
      velocity: this.velocity,
      state: this.state,
      desiredDirection: this.targetDir,
      dimensions: this.movementDimensions,
      desiredSpeed: 0,
      jumpSpeed: 0,
      jumpRequested: false,
      flightRequested: false,
      random: Math.random,
    };
    this.registerBehaviorState({ id: 'active' });
    this.registerBehaviorState({
      id: 'wandering',
      parentId: 'active',
      onUpdate: (animal, deltaSeconds) => animal.updateWanderingBehavior(deltaSeconds),
    });
    this.registerBehaviorState({
      id: 'panicked',
      parentId: 'active',
      onUpdate: (animal, deltaSeconds) => animal.updatePanickedBehavior(deltaSeconds),
    });
    this.behaviorStateMachine.start('wandering', this);
  }

  public lootTableId?: string;

  public abstract initMesh(): void;

  public getBehaviorStateId(): string {
    return this.behaviorStateMachine.currentStateId ?? 'wandering';
  }

  public transitionBehavior(stateId: string): void {
    this.behaviorStateMachine.transitionTo(stateId, this);
  }

  public setMovementModes(modeIds: readonly string[]): void {
    this.movementController.setModes(modeIds);
  }

  public getMovementModeIds(): readonly string[] {
    return this.movementController.modeIds;
  }

  public getActiveMovementModeId(): string | null {
    return this.movementController.activeModeId;
  }

  protected registerBehaviorState(state: BehaviorStateDefinition<Animal>): void {
    this.behaviorStateMachine.registerState(state);
  }

  protected setBehaviorState(stateId: string): void {
    this.behaviorStateMachine.transitionTo(stateId, this);
  }
  
  public dropItems(): void {
    if (this.lootTableId) {
      const dropPos = this.position.clone().add(new THREE.Vector3(0, 0.3, 0));
      const context = {
        world: this.world,
        position: dropPos
      };
      LootTableHelper.spawnDrops(this.lootTableId, context, true);
    }
  }

  public getBoundingBox(pos = this.position): THREE.Box3 {
    return VoxelCollider.getBoundingBox(pos, { width: this.width, height: this.height, depth: this.depth });
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

  public dispose(): void {
    this.behaviorStateMachine.dispose(this);
  }

  protected updateAI(dt: number) {
    this.behaviorStateMachine.update(this, dt);
  }

  protected updateWanderingBehavior(dt: number): void {
    this.aiTimer -= dt;

    if (this.aiTimer <= 0) {
      if (Math.random() < 0.6) {
        const angle = Math.random() * Math.PI * 2;
        this.targetDir.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
        this.aiTimer = Math.random() * 3 + 2;
      } else {
        this.targetDir.set(0, 0, 0);
        this.aiTimer = Math.random() * 2 + 1;
      }
    }
  }

  protected updatePanickedBehavior(dt: number): void {
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.setBehaviorState('wandering');
      this.aiTimer = Math.random() * 3 + 2;
    } else if (Math.random() < 0.05) {
      const angle = Math.random() * Math.PI * 2;
      this.targetDir.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
    }
  }

  protected updatePhysics(dt: number) {
    this.state.inWater = this.checkInWater();
    this.movementDimensions.width = this.width;
    this.movementDimensions.height = this.height;
    this.movementDimensions.depth = this.depth;
    this.movementContext.desiredSpeed = this.getDesiredMovementSpeed();
    this.movementContext.jumpSpeed = this.jumpSpeed;
    this.movementContext.jumpRequested = this.shouldJump;
    this.movementContext.flightRequested = this.flightRequested;
    this.movementController.update(this.movementContext, dt);
    this.shouldJump = this.movementContext.jumpRequested;
  }

  protected getDesiredMovementSpeed(): number {
    return this.behaviorStateMachine.isInState('panicked') ? this.panicSpeed : this.walkSpeed;
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
    this.isPersistent = true; // Mark as persistent upon taking damage
    this.setBehaviorState('panicked');
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

  protected serializeCustomData(): EntityExtensionData | undefined {
    return {
      behaviorStateId: this.getBehaviorStateId(),
      movementModeIds: [...this.movementController.modeIds],
      activeMovementModeId: this.movementController.activeModeId,
    };
  }

  protected deserializeCustomData(customData: EntityExtensionData): void {
    if (Array.isArray(customData.movementModeIds)) {
      const modeIds = customData.movementModeIds.filter(
        (modeId): modeId is string => typeof modeId === 'string',
      );
      if (modeIds.length > 0) {
        this.setMovementModes(modeIds);
      }
    }
    if (typeof customData.behaviorStateId === 'string'
      && this.behaviorStateMachine.hasState(customData.behaviorStateId)) {
      this.transitionBehavior(customData.behaviorStateId);
    }
  }
}

