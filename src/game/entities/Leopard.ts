import * as THREE from 'three';
import type { World } from '@game/world/World';
import { Animal, type AnimalOptions } from './Animal';

const LEOPARD_CONFIG = {
  maxLife: 16,
  walkSpeed: 2.4,
  panicSpeed: 6,
  jumpSpeed: 6.8,
} as const;

/**
 * 花豹：表现层 + 物种特有动画。
 * 捕猎/运动模式由 Animal 底座 + SpeciesCombatProfile 驱动，避免物种内硬编码 AI 分支。
 */
export class Leopard extends Animal {
  public width = 0.9;
  public height = 1;
  public depth = 1.4;

  protected walkSpeed = LEOPARD_CONFIG.walkSpeed;
  protected panicSpeed = LEOPARD_CONFIG.panicSpeed;
  protected jumpSpeed = LEOPARD_CONFIG.jumpSpeed;

  public hurtSound = 'playLeopardHurt';
  public deathSound = 'playLeopardDeath';

  private readonly legs: THREE.Mesh[] = [];

  public constructor(
    id: string,
    spawnPosition: THREE.Vector3,
    world: World,
    movementModeIds: readonly string[],
    options: AnimalOptions = {},
  ) {
    super(
      id,
      'cloudcraft:leopard',
      spawnPosition,
      world,
      LEOPARD_CONFIG.maxLife,
      movementModeIds,
      options,
    );
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

    // 共享 geometry：AnimalManager 释放时会按引用去重 dispose
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
}
