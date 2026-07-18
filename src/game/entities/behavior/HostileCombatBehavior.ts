import * as THREE from 'three';
import type { HumanTarget } from '../sensing/HumanTarget';
import type { SpeciesCombatProfile } from '../species/SpeciesDefinition';

const CIRCLING_APPROACH_RATIO = 0.55;

export const HostileCombatStateId = {
  HUNTING: 'hunting',
  STALKING: 'stalking',
  CIRCLING: 'circling',
  POUNCING: 'pouncing',
  RECOVERING: 'recovering',
} as const;

interface HostileCombatHost {
  readonly position: THREE.Vector3;
  readonly targetDirection: THREE.Vector3;
  getTarget(): HumanTarget | null;
  hasAwarenessOf(target: HumanTarget): boolean;
  damageTarget(target: HumanTarget, amount: number): void;
  playAttackSound(soundKey: string): void;
}

export interface HostileCombatSnapshot {
  readonly attackCooldownSeconds: number;
  readonly combatActionTimerSeconds: number;
  readonly circlingDirection: number;
  readonly attackHasConnected: boolean;
  readonly pounceHasLaunched: boolean;
}

/**
 * 可配置的近战捕猎控制器。它只维护战斗动作状态，状态切换仍由 Animal 的 HFSM 负责。
 */
export class HostileCombatBehavior {
  private readonly profile: SpeciesCombatProfile;
  private readonly host: HostileCombatHost;
  private readonly random: () => number;
  private attackCooldownSeconds = 0;
  private actionTimerSeconds = 0;
  private circlingDirection = 1;
  private attackHasConnected = false;
  private pounceHasLaunched = false;

  public constructor(
    profile: SpeciesCombatProfile,
    host: HostileCombatHost,
    random: () => number = Math.random,
  ) {
    this.profile = profile;
    this.host = host;
    this.random = random;
  }

  public updateCooldown(deltaSeconds: number): void {
    this.attackCooldownSeconds = Math.max(0, this.attackCooldownSeconds - deltaSeconds);
  }

  public beginCircling(): void {
    this.circlingDirection = this.random() < 0.5 ? -1 : 1;
    const durationVariance = 0.8 + this.random() * 0.4;
    this.actionTimerSeconds = this.profile.circlingDurationSeconds * durationVariance;
  }

  public beginPounce(): void {
    this.actionTimerSeconds = this.profile.pounceWindupSeconds
      + this.profile.pounceDurationSeconds;
    this.attackHasConnected = false;
    this.pounceHasLaunched = false;
  }

  public beginRecovery(): void {
    this.actionTimerSeconds = this.profile.recoveryDurationSeconds;
    this.attackCooldownSeconds = this.profile.attackIntervalSeconds;
  }

  public updateStalking(): void {
    this.faceTarget();
  }

  public updateCircling(deltaSeconds: number): void {
    this.actionTimerSeconds = Math.max(0, this.actionTimerSeconds - deltaSeconds);
    const target = this.getAwareTarget();
    if (!target) {
      this.host.targetDirection.set(0, 0, 0);
      return;
    }

    const direction = this.host.targetDirection;
    direction.subVectors(target.position, this.host.position);
    direction.y = 0;
    const distance = direction.length();
    if (distance <= Number.EPSILON) {
      direction.set(0, 0, 0);
      return;
    }

    direction.multiplyScalar(1 / distance);
    const directX = direction.x;
    const directZ = direction.z;
    const desiredOrbitDistance = this.profile.attackDistance
      + (this.profile.pounceDistance - this.profile.attackDistance) * CIRCLING_APPROACH_RATIO;
    const radialCorrection = THREE.MathUtils.clamp(
      (distance - desiredOrbitDistance) / desiredOrbitDistance,
      -0.35,
      0.65,
    );
    direction.set(
      -directZ * this.circlingDirection + directX * radialCorrection,
      0,
      directX * this.circlingDirection + directZ * radialCorrection,
    ).normalize();
  }

  public updatePouncing(deltaSeconds: number): void {
    this.actionTimerSeconds = Math.max(0, this.actionTimerSeconds - deltaSeconds);
    const isWindup = this.actionTimerSeconds > this.profile.pounceDurationSeconds;
    if (isWindup) {
      const target = this.getAwareTarget();
      if (!target) {
        this.host.targetDirection.set(0, 0, 0);
        return;
      }
      this.faceTarget();
      this.host.targetDirection.multiplyScalar(0.08);
      return;
    }

    if (!this.pounceHasLaunched) {
      const target = this.getAwareTarget();
      if (!target) {
        this.host.targetDirection.set(0, 0, 0);
        return;
      }
      // 起跳后锁定扑击向量，保留猛兽扑空的可能性，避免高速阶段追踪转向。
      this.faceTarget();
      this.pounceHasLaunched = true;
      if (this.profile.attackSound) {
        this.host.playAttackSound(this.profile.attackSound);
      }
    }

    const target = this.getAwareTarget();
    if (
      target
      && !this.attackHasConnected
      && this.host.position.distanceTo(target.position) <= this.profile.attackDistance
    ) {
      this.host.damageTarget(target, this.profile.attackDamage);
      this.attackHasConnected = true;
    }
  }

  public updateRecovering(deltaSeconds: number): void {
    this.actionTimerSeconds = Math.max(0, this.actionTimerSeconds - deltaSeconds);
    const target = this.host.getTarget();
    if (!target) {
      this.host.targetDirection.set(0, 0, 0);
      return;
    }
    this.host.targetDirection.subVectors(this.host.position, target.position);
    this.host.targetDirection.y = 0;
    if (this.host.targetDirection.lengthSq() > 0) {
      this.host.targetDirection.normalize();
    }
  }

  public canSenseTarget(): boolean {
    const target = this.host.getTarget();
    return !!target
      && this.host.position.distanceTo(target.position) <= this.profile.awarenessDistance
      && this.host.hasAwarenessOf(target);
  }

  public shouldBeginCircling(): boolean {
    const target = this.getAwareTarget();
    return !!target
      && this.host.position.distanceTo(target.position) <= this.profile.circlingDistance;
  }

  public shouldResumeStalking(): boolean {
    const target = this.getAwareTarget();
    return !!target
      && this.host.position.distanceTo(target.position) > this.profile.circlingDistance;
  }

  public canPounce(): boolean {
    const target = this.getAwareTarget();
    return !!target
      && this.actionTimerSeconds <= 0
      && this.attackCooldownSeconds <= 0
      && this.host.position.distanceTo(target.position) <= this.profile.pounceDistance;
  }

  public isActionComplete(): boolean {
    return this.actionTimerSeconds <= 0;
  }

  public getDesiredSpeed(stateId: string): number | null {
    switch (stateId) {
      case HostileCombatStateId.STALKING:
        return this.profile.stalkingSpeed;
      case HostileCombatStateId.CIRCLING:
        return this.profile.circlingSpeed;
      case HostileCombatStateId.POUNCING:
        return this.actionTimerSeconds > this.profile.pounceDurationSeconds
          ? 0
          : this.profile.pounceSpeed;
      case HostileCombatStateId.RECOVERING:
        return this.profile.recoverySpeed;
      default:
        return null;
    }
  }

  public getAttackCooldownSeconds(): number {
    return this.attackCooldownSeconds;
  }

  public createSnapshot(): HostileCombatSnapshot {
    return {
      attackCooldownSeconds: this.attackCooldownSeconds,
      combatActionTimerSeconds: this.actionTimerSeconds,
      circlingDirection: this.circlingDirection,
      attackHasConnected: this.attackHasConnected,
      pounceHasLaunched: this.pounceHasLaunched,
    };
  }

  public restoreSnapshot(snapshot: Readonly<Record<string, unknown>>): void {
    this.attackCooldownSeconds = finiteNonNegative(
      snapshot.attackCooldownSeconds,
      this.attackCooldownSeconds,
    );
    this.actionTimerSeconds = finiteNonNegative(
      snapshot.combatActionTimerSeconds,
      this.actionTimerSeconds,
    );
    if (snapshot.circlingDirection === -1 || snapshot.circlingDirection === 1) {
      this.circlingDirection = snapshot.circlingDirection;
    }
    if (typeof snapshot.attackHasConnected === 'boolean') {
      this.attackHasConnected = snapshot.attackHasConnected;
    }
    if (typeof snapshot.pounceHasLaunched === 'boolean') {
      this.pounceHasLaunched = snapshot.pounceHasLaunched;
    }
  }

  private faceTarget(): void {
    const target = this.getAwareTarget();
    if (!target) {
      this.host.targetDirection.set(0, 0, 0);
      return;
    }
    this.host.targetDirection.subVectors(target.position, this.host.position);
    this.host.targetDirection.y = 0;
    if (this.host.targetDirection.lengthSq() > 0) {
      this.host.targetDirection.normalize();
    }
  }

  private getAwareTarget(): HumanTarget | null {
    const target = this.host.getTarget();
    return target && this.host.hasAwarenessOf(target) ? target : null;
  }
}

function finiteNonNegative(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback;
}
