import * as THREE from 'three';
import { World } from '@game/world/World';
import { getBlockProperties } from '@game/world/BlockConfig';
import { VoxelCollider } from '@game/physics/voxel/VoxelCollider';
import { sound } from '@game/systems/Sound';
import { LootTableHelper } from '../loot/LootTableHelper';
import { Entity, type EntityExtensionData, type EntitySnapshotValue } from './Entity';
import {
  BehaviorStateMachine,
  type BehaviorStateDefinition,
  type BehaviorTransition,
} from './behavior/BehaviorStateMachine';
import {
  MovementModeController,
  type MovementModeRegistry,
} from './movement/MovementMode';
import {
  CoreMovementModeId,
  coreMovementModeRegistry,
  type CreatureMovementContext,
} from './movement/CoreMovementModes';
import type { SpeciesCombatProfile } from './species/SpeciesDefinition';
import { hasBlockLineOfSight } from './sensing/LineOfSight';
import { resolveHumanTarget, type HumanTarget } from './sensing/HumanTarget';

const DEFAULT_MOVEMENT_MODE_IDS = [
  CoreMovementModeId.SWIM,
  CoreMovementModeId.GROUND,
] as const;

const PANIC_DURATION_SECONDS = 5;

export interface AnimalOptions {
  readonly movementModeRegistry?: MovementModeRegistry<CreatureMovementContext>;
  readonly combat?: SpeciesCombatProfile;
}

export abstract class Animal extends Entity {
  public state = { onGround: false, inWater: false };

  // Physical size
  public abstract width: number;
  public abstract height: number;
  public abstract depth: number;

  // AI & Behavior State
  protected readonly behaviorStateMachine = new BehaviorStateMachine<Animal>();
  protected readonly movementController: MovementModeController<CreatureMovementContext>;
  protected readonly combatProfile: SpeciesCombatProfile | null;
  protected aiTimer = 0;
  protected targetDir = new THREE.Vector3();
  protected shouldJump = false;
  protected flightRequested = false;
  protected attackCooldownSeconds = 0;
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

  // Sound keys：SoundManager 上的方法名（如 playPigHurt）
  public abstract hurtSound: string;
  public abstract deathSound: string;

  constructor(
    id: string,
    type: string,
    spawnPos: THREE.Vector3,
    world: World,
    maxLife = 10,
    movementModeIds: readonly string[] = DEFAULT_MOVEMENT_MODE_IDS,
    options: AnimalOptions = {},
  ) {
    super(id, type, spawnPos, world, maxLife);
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);
    this.combatProfile = options.combat ?? null;
    this.movementController = new MovementModeController(
      options.movementModeRegistry ?? coreMovementModeRegistry,
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
    if (this.combatProfile) {
      this.installHostileHumanBehaviors();
    }
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

  public getAttackCooldownSeconds(): number {
    return this.attackCooldownSeconds;
  }

  protected registerBehaviorState(state: BehaviorStateDefinition<Animal>): void {
    this.behaviorStateMachine.registerState(state);
  }

  protected registerBehaviorTransition(transition: BehaviorTransition<Animal>): void {
    this.behaviorStateMachine.registerTransition(transition);
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
    if (this.combatProfile) {
      this.attackCooldownSeconds = Math.max(0, this.attackCooldownSeconds - dt);
    }
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
    if (this.combatProfile) {
      if (this.behaviorStateMachine.isInState('attacking')) {
        return this.combatProfile.attackSpeed;
      }
      if (this.behaviorStateMachine.isInState('stalking')) {
        return this.combatProfile.stalkingSpeed;
      }
    }
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
    this.aiTimer = PANIC_DURATION_SECONDS;

    // Choose panic direction away from current velocity or randomly
    const angle = Math.random() * Math.PI * 2;
    this.targetDir.set(Math.sin(angle), 0, Math.cos(angle)).normalize();

    this.triggerHurtVisual();
    this.playCreatureSound(this.hurtSound);

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
    this.playCreatureSound(this.deathSound);
    this.dropItems();
  }

  protected playCreatureSound(soundKey: string): void {
    if (!soundKey) return;
    // 统一走 SoundManager.play：按方法名查找（playPigHurt / playLeopardHurt 等）
    if (typeof sound.play === 'function') {
      sound.play(soundKey);
      return;
    }
    const fallbackFn = (sound as unknown as Record<string, unknown>)[soundKey];
    if (typeof fallbackFn === 'function') {
      fallbackFn.call(sound);
    }
  }

  protected serializeCustomData(): EntityExtensionData | undefined {
    const data: Record<string, EntitySnapshotValue> = {
      behaviorStateId: this.getBehaviorStateId(),
      movementModeIds: [...this.movementController.modeIds],
      aiTimer: this.aiTimer,
      targetDirX: this.targetDir.x,
      targetDirY: this.targetDir.y,
      targetDirZ: this.targetDir.z,
    };
    if (this.combatProfile) {
      data.attackCooldownSeconds = this.attackCooldownSeconds;
    }
    return data;
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

    if (typeof customData.aiTimer === 'number' && Number.isFinite(customData.aiTimer)) {
      this.aiTimer = Math.max(0, customData.aiTimer);
    }

    if (
      typeof customData.targetDirX === 'number'
      && typeof customData.targetDirY === 'number'
      && typeof customData.targetDirZ === 'number'
      && Number.isFinite(customData.targetDirX)
      && Number.isFinite(customData.targetDirY)
      && Number.isFinite(customData.targetDirZ)
    ) {
      this.targetDir.set(customData.targetDirX, customData.targetDirY, customData.targetDirZ);
    }

    if (
      this.combatProfile
      && typeof customData.attackCooldownSeconds === 'number'
      && Number.isFinite(customData.attackCooldownSeconds)
    ) {
      this.attackCooldownSeconds = Math.max(0, customData.attackCooldownSeconds);
    }

    // 兼容 0.2.x 旧字段 aiState；正式字段为 behaviorStateId
    const behaviorStateId = resolveBehaviorStateId(customData);
    if (behaviorStateId && this.behaviorStateMachine.hasState(behaviorStateId)) {
      this.transitionBehavior(behaviorStateId);
      // 若旧档/缺省计时器恢复到 panicked，补满惊慌时长，避免下一帧立刻退出
      if (behaviorStateId === 'panicked' && this.aiTimer <= 0) {
        this.aiTimer = PANIC_DURATION_SECONDS;
      }
    }
  }

  private installHostileHumanBehaviors(): void {
    this.registerBehaviorState({
      id: 'stalking',
      parentId: 'active',
      onUpdate: animal => animal.updateStalkingBehavior(),
    });
    this.registerBehaviorState({
      id: 'attacking',
      parentId: 'active',
      onUpdate: animal => animal.updateAttackingBehavior(),
    });

    // 声明式转移：优先级 attack > stalk > 回落 wandering；惊慌态由 takeDamage 强制切入并在 when 中排除
    this.registerBehaviorTransition({
      from: 'active',
      to: 'attacking',
      priority: 30,
      when: animal => animal.canEngageHostileCombat() && animal.isHumanInAttackRange(),
    });
    this.registerBehaviorTransition({
      from: 'active',
      to: 'stalking',
      priority: 20,
      when: animal => animal.canEngageHostileCombat()
        && animal.isHumanInAwarenessRange()
        && !animal.isHumanInAttackRange(),
    });
    this.registerBehaviorTransition({
      from: 'stalking',
      to: 'wandering',
      priority: 10,
      when: animal => !animal.canEngageHostileCombat() || !animal.isHumanInAwarenessRange(),
    });
    this.registerBehaviorTransition({
      from: 'attacking',
      to: 'wandering',
      priority: 10,
      when: animal => !animal.canEngageHostileCombat() || !animal.isHumanInAwarenessRange(),
    });
    this.registerBehaviorTransition({
      from: 'attacking',
      to: 'stalking',
      priority: 15,
      when: animal => animal.canEngageHostileCombat()
        && animal.isHumanInAwarenessRange()
        && !animal.isHumanInAttackRange(),
    });
  }

  protected canEngageHostileCombat(): boolean {
    return !!this.combatProfile && !this.behaviorStateMachine.isInState('panicked');
  }

  protected isHumanInAttackRange(): boolean {
    const combat = this.combatProfile;
    const target = this.getHumanTarget();
    if (!combat || !target) return false;
    if (this.position.distanceTo(target.position) > combat.attackDistance) return false;
    return this.hasAwarenessOf(target);
  }

  protected isHumanInAwarenessRange(): boolean {
    const combat = this.combatProfile;
    const target = this.getHumanTarget();
    if (!combat || !target) return false;
    if (this.position.distanceTo(target.position) > combat.awarenessDistance) return false;
    return this.hasAwarenessOf(target);
  }

  protected hasAwarenessOf(target: HumanTarget): boolean {
    const combat = this.combatProfile;
    if (!combat) return false;
    if (!combat.requireLineOfSight) return true;
    return hasBlockLineOfSight(this.world, this.position, target.position, {
      eyeHeight: this.height * 0.75,
    });
  }

  protected updateStalkingBehavior(): void {
    this.faceHumanTarget();
  }

  protected updateAttackingBehavior(): void {
    const combat = this.combatProfile;
    const target = this.getHumanTarget();
    if (!combat || !target) return;
    this.faceHumanTarget();
    if (
      this.position.distanceTo(target.position) <= combat.attackDistance
      && this.attackCooldownSeconds <= 0
      && this.hasAwarenessOf(target)
    ) {
      target.takeDamage(
        combat.attackDamage,
        this.world,
        this.world.game?.physics,
      );
      this.attackCooldownSeconds = combat.attackIntervalSeconds;
    }
  }

  protected faceHumanTarget(): void {
    const target = this.getHumanTarget();
    if (!target) return;
    this.targetDir.subVectors(target.position, this.position);
    this.targetDir.y = 0;
    if (this.targetDir.lengthSq() > 0) this.targetDir.normalize();
  }

  protected getHumanTarget(): HumanTarget | null {
    return resolveHumanTarget(this.world);
  }
}

function resolveBehaviorStateId(customData: EntityExtensionData): string | null {
  if (typeof customData.behaviorStateId === 'string') {
    return customData.behaviorStateId;
  }
  if (typeof customData.aiState === 'string') {
    return customData.aiState;
  }
  return null;
}
