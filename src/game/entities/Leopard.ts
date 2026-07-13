import * as THREE from 'three';
import type { World } from '@game/world/World';
import { Animal } from './Animal';

const LEOPARD_CONFIG = {
  maxLife: 16,
  walkSpeed: 2.4,
  stalkingSpeed: 3.6,
  attackSpeed: 5.2,
  panicSpeed: 6,
  jumpSpeed: 6.8,
  awarenessDistance: 14,
  attackDistance: 1.6,
  attackDamage: 2,
  attackIntervalSeconds: 1.1,
} as const;

interface HumanTarget {
  readonly position: THREE.Vector3;
  takeDamage(amount: number, world: World, physics: unknown): void;
}

export class Leopard extends Animal {
  public width = 0.9;
  public height = 1;
  public depth = 1.4;

  protected walkSpeed = LEOPARD_CONFIG.walkSpeed;
  protected panicSpeed = LEOPARD_CONFIG.panicSpeed;
  protected jumpSpeed = LEOPARD_CONFIG.jumpSpeed;

  public hurtSound = 'cloudcraft:leopard_hurt';
  public deathSound = 'cloudcraft:leopard_death';

  private readonly legs: THREE.Mesh[] = [];
  private attackCooldownSeconds = 0;

  public constructor(
    id: string,
    spawnPosition: THREE.Vector3,
    world: World,
    movementModeIds: readonly string[],
  ) {
    super(
      id,
      'cloudcraft:leopard',
      spawnPosition,
      world,
      LEOPARD_CONFIG.maxLife,
      movementModeIds,
    );
    this.registerBehaviorState({
      id: 'stalking',
      parentId: 'active',
      onUpdate: (_animal, deltaSeconds) => this.updateStalkingBehavior(deltaSeconds),
    });
    this.registerBehaviorState({
      id: 'attacking',
      parentId: 'active',
      onUpdate: (_animal, deltaSeconds) => this.updateAttackingBehavior(deltaSeconds),
    });
    this.initMesh();
  }

  public initMesh(): void {
    const coatMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8a43b,
      roughness: 0.88,
      metalness: 0.02,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d251b,
      roughness: 0.95,
    });
    const muzzleMaterial = new THREE.MeshStandardMaterial({
      color: 0xe4cf9b,
      roughness: 0.9,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 1.25), coatMaterial);
    body.position.set(0, 0.62, 0.05);
    body.castShadow = true;
    this.mesh.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, 0.58), coatMaterial);
    head.position.set(0, 0.86, -0.68);
    head.castShadow = true;
    this.mesh.add(head);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.2), muzzleMaterial);
    muzzle.position.set(0, 0.74, -1.02);
    this.mesh.add(muzzle);

    const earGeometry = new THREE.BoxGeometry(0.16, 0.2, 0.1);
    for (const x of [-0.2, 0.2]) {
      const ear = new THREE.Mesh(earGeometry, darkMaterial);
      ear.position.set(x, 1.16, -0.7);
      this.mesh.add(ear);
    }

    const legGeometry = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    for (const [x, z] of [[-0.25, -0.38], [0.25, -0.38], [-0.25, 0.45], [0.25, 0.45]]) {
      const leg = new THREE.Mesh(legGeometry, coatMaterial);
      leg.position.set(x, 0.28, z);
      leg.castShadow = true;
      this.legs.push(leg);
      this.mesh.add(leg);
    }

    const spotGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.03);
    for (const [x, y, z] of [
      [-0.37, 0.72, -0.25], [0.37, 0.64, 0.1], [-0.37, 0.55, 0.42],
      [0.2, 0.9, -0.68], [-0.18, 0.98, -0.7],
    ]) {
      const spot = new THREE.Mesh(spotGeometry, darkMaterial);
      spot.position.set(x, y, z);
      this.mesh.add(spot);
    }

    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6),
      coatMaterial,
    );
    tail.position.set(0, 0.64, 0.92);
    tail.rotation.x = Math.PI * 0.38;
    this.mesh.add(tail);
  }

  public override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const phase = performance.now() * 0.012;
    for (let index = 0; index < this.legs.length; index++) {
      const target = speed > 0.05 ? Math.sin(phase + (index % 2) * Math.PI) * 0.55 : 0;
      this.legs[index].rotation.x += (target - this.legs[index].rotation.x)
        * Math.min(1, deltaSeconds * 10);
    }
  }

  protected override updateAI(deltaSeconds: number): void {
    this.attackCooldownSeconds = Math.max(0, this.attackCooldownSeconds - deltaSeconds);
    if (this.behaviorStateMachine.isInState('panicked')) {
      super.updateAI(deltaSeconds);
      return;
    }

    const target = this.getHumanTarget();
    if (!target) {
      if (this.behaviorStateMachine.isInState('stalking')
        || this.behaviorStateMachine.isInState('attacking')) {
        this.setBehaviorState('wandering');
      }
      super.updateAI(deltaSeconds);
      return;
    }

    const distance = this.position.distanceTo(target.position);
    if (distance <= LEOPARD_CONFIG.attackDistance) {
      this.setBehaviorState('attacking');
    } else if (distance <= LEOPARD_CONFIG.awarenessDistance) {
      this.setBehaviorState('stalking');
    } else if (this.behaviorStateMachine.isInState('stalking')
      || this.behaviorStateMachine.isInState('attacking')) {
      this.setBehaviorState('wandering');
    }
    super.updateAI(deltaSeconds);
  }

  protected override getDesiredMovementSpeed(): number {
    if (this.behaviorStateMachine.isInState('attacking')) return LEOPARD_CONFIG.attackSpeed;
    if (this.behaviorStateMachine.isInState('stalking')) return LEOPARD_CONFIG.stalkingSpeed;
    return super.getDesiredMovementSpeed();
  }

  private updateStalkingBehavior(_deltaSeconds: number): void {
    this.faceHumanTarget();
  }

  private updateAttackingBehavior(_deltaSeconds: number): void {
    const target = this.getHumanTarget();
    if (!target) return;
    this.faceHumanTarget();
    if (
      this.position.distanceTo(target.position) <= LEOPARD_CONFIG.attackDistance
      && this.attackCooldownSeconds <= 0
    ) {
      target.takeDamage(
        LEOPARD_CONFIG.attackDamage,
        this.world,
        this.world.game?.physics,
      );
      this.attackCooldownSeconds = LEOPARD_CONFIG.attackIntervalSeconds;
    }
  }

  private faceHumanTarget(): void {
    const target = this.getHumanTarget();
    if (!target) return;
    this.targetDir.subVectors(target.position, this.position);
    this.targetDir.y = 0;
    if (this.targetDir.lengthSq() > 0) this.targetDir.normalize();
  }

  private getHumanTarget(): HumanTarget | null {
    const player = this.world.game?.player as Partial<HumanTarget> | undefined;
    return player?.position instanceof THREE.Vector3 && typeof player.takeDamage === 'function'
      ? player as HumanTarget
      : null;
  }
}
