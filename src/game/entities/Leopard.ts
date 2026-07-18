import * as THREE from 'three';
import type { World } from '@game/world/World';
import { Animal, type AnimalOptions } from './Animal';

const LEOPARD_CONFIG = {
  maxLife: 16,
  walkSpeed: 2.4,
  panicSpeed: 6,
  jumpSpeed: 6.8,
  animationBlendSpeed: 10,
  gaitSpeed: 8.5,
  runGaitSpeed: 15,
} as const;

const LEOPARD_PALETTE = {
  coat: '#d9a441',
  coatLight: '#e8bd62',
  rosette: '#34271c',
  cream: 0xead7a2,
  nose: 0x241b18,
  eye: 0xe6c24c,
  innerEar: 0x9d5b4f,
} as const;

const LEOPARD_POSE = {
  bodyY: 0.62,
  headY: 0.88,
  headZ: -0.76,
  legY: 0.47,
  frontLegZ: -0.43,
  rearLegZ: 0.48,
  legX: 0.27,
} as const;

/**
 * 花豹表现层：像素斑纹方块模型与状态驱动姿态。
 * 捕猎决策由 Animal + SpeciesCombatProfile 组合，物种类不包含目标判定分支。
 */
export class Leopard extends Animal {
  public width = 0.9;
  public height = 1.08;
  public depth = 1.55;

  protected walkSpeed = LEOPARD_CONFIG.walkSpeed;
  protected panicSpeed = LEOPARD_CONFIG.panicSpeed;
  protected jumpSpeed = LEOPARD_CONFIG.jumpSpeed;

  public hurtSound = 'playLeopardHurt';
  public deathSound = 'playLeopardDeath';

  private static coatTexture: THREE.Texture;
  private static fineSpotTexture: THREE.Texture;

  private readonly bodyRoot = new THREE.Group();
  private readonly headRoot = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly tailJoints: THREE.Group[] = [];
  private animationTime = 0;

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

  private static createRosetteTexture(finePattern: boolean): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillStyle = finePattern ? LEOPARD_PALETTE.coatLight : LEOPARD_PALETTE.coat;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const rosettes = finePattern
      ? [[3, 4], [13, 3], [23, 6], [8, 15], [19, 16], [28, 20], [3, 27], [16, 28]]
      : [[4, 5], [18, 3], [27, 11], [10, 17], [22, 22], [3, 28], [15, 30]];
    context.fillStyle = LEOPARD_PALETTE.rosette;
    for (const [x, y] of rosettes) {
      const size = finePattern ? 2 : 3;
      context.fillRect(x, y, size + 2, size);
      context.fillRect(x + 1, y - 1, size, size + 2);
      context.fillStyle = LEOPARD_PALETTE.coat;
      context.fillRect(x + 2, y + 1, 1, 1);
      context.fillStyle = LEOPARD_PALETTE.rosette;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private static initTextures(): void {
    if (this.coatTexture) return;
    this.coatTexture = this.createRosetteTexture(false);
    this.fineSpotTexture = this.createRosetteTexture(true);
  }

  public initMesh(): void {
    Leopard.initTextures();

    const coatMaterial = new THREE.MeshStandardMaterial({
      map: Leopard.coatTexture,
      roughness: 0.86,
      metalness: 0.01,
    });
    const fineSpotMaterial = new THREE.MeshStandardMaterial({
      map: Leopard.fineSpotTexture,
      roughness: 0.88,
      metalness: 0.01,
    });
    const creamMaterial = new THREE.MeshStandardMaterial({
      color: LEOPARD_PALETTE.cream,
      roughness: 0.92,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: LEOPARD_PALETTE.nose,
      roughness: 0.94,
    });
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: LEOPARD_PALETTE.eye,
      roughness: 0.55,
    });
    const innerEarMaterial = new THREE.MeshStandardMaterial({
      color: LEOPARD_PALETTE.innerEar,
      roughness: 0.95,
    });

    this.mesh.add(this.bodyRoot);
    this.addBody(coatMaterial, creamMaterial);
    this.addHead(fineSpotMaterial, creamMaterial, darkMaterial, eyeMaterial, innerEarMaterial);
    this.addLegs(coatMaterial, darkMaterial);
    this.addTail(coatMaterial, darkMaterial);
  }

  private addBody(coat: THREE.Material, cream: THREE.Material): void {
    const torso = this.createBox(0.72, 0.48, 1.22, coat);
    torso.position.set(0, LEOPARD_POSE.bodyY, 0.06);
    this.bodyRoot.add(torso);

    const shoulders = this.createBox(0.78, 0.54, 0.46, coat);
    shoulders.position.set(0, LEOPARD_POSE.bodyY + 0.03, -0.37);
    this.bodyRoot.add(shoulders);

    const haunches = this.createBox(0.75, 0.52, 0.42, coat);
    haunches.position.set(0, LEOPARD_POSE.bodyY + 0.02, 0.48);
    this.bodyRoot.add(haunches);

    const belly = this.createBox(0.5, 0.08, 0.74, cream);
    belly.position.set(0, LEOPARD_POSE.bodyY - 0.27, 0.05);
    this.bodyRoot.add(belly);
  }

  private addHead(
    coat: THREE.Material,
    cream: THREE.Material,
    dark: THREE.Material,
    eye: THREE.Material,
    innerEar: THREE.Material,
  ): void {
    this.headRoot.position.set(0, LEOPARD_POSE.headY, LEOPARD_POSE.headZ);
    this.bodyRoot.add(this.headRoot);

    const head = this.createBox(0.58, 0.48, 0.52, coat);
    this.headRoot.add(head);

    const brow = this.createBox(0.52, 0.11, 0.08, coat);
    brow.position.set(0, 0.1, -0.29);
    this.headRoot.add(brow);

    for (const side of [-1, 1]) {
      const cheek = this.createBox(0.22, 0.2, 0.16, cream);
      cheek.position.set(side * 0.11, -0.12, -0.31);
      this.headRoot.add(cheek);

      const eyePlate = this.createBox(0.12, 0.08, 0.025, eye);
      eyePlate.position.set(side * 0.17, 0.06, -0.304);
      this.headRoot.add(eyePlate);

      const pupil = this.createBox(0.035, 0.075, 0.032, dark);
      pupil.position.set(side * 0.17, 0.06, -0.322);
      this.headRoot.add(pupil);

      const ear = new THREE.Group();
      ear.position.set(side * 0.2, 0.29, 0.03);
      ear.rotation.z = side * -0.16;
      const earOuter = this.createBox(0.17, 0.23, 0.11, dark);
      const earInner = this.createBox(0.1, 0.15, 0.02, innerEar);
      earInner.position.z = -0.065;
      ear.add(earOuter, earInner);
      this.headRoot.add(ear);
    }

    const muzzle = this.createBox(0.3, 0.16, 0.18, cream);
    muzzle.position.set(0, -0.16, -0.38);
    this.headRoot.add(muzzle);

    const nose = this.createBox(0.15, 0.09, 0.06, dark);
    nose.position.set(0, -0.11, -0.49);
    this.headRoot.add(nose);

    const chin = this.createBox(0.2, 0.07, 0.12, cream);
    chin.position.set(0, -0.27, -0.39);
    this.headRoot.add(chin);
  }

  private addLegs(coat: THREE.Material, dark: THREE.Material): void {
    const legGeometry = new THREE.BoxGeometry(0.17, 0.5, 0.18);
    legGeometry.translate(0, -0.25, 0);
    const pawGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.28);
    pawGeometry.translate(0, -0.47, -0.045);

    const positions = [
      [-LEOPARD_POSE.legX, LEOPARD_POSE.frontLegZ],
      [LEOPARD_POSE.legX, LEOPARD_POSE.frontLegZ],
      [-LEOPARD_POSE.legX, LEOPARD_POSE.rearLegZ],
      [LEOPARD_POSE.legX, LEOPARD_POSE.rearLegZ],
    ] as const;
    for (const [x, z] of positions) {
      const leg = new THREE.Group();
      leg.position.set(x, LEOPARD_POSE.legY, z);
      const limb = new THREE.Mesh(legGeometry, coat);
      const paw = new THREE.Mesh(pawGeometry, dark);
      limb.castShadow = true;
      paw.castShadow = true;
      leg.add(limb, paw);
      this.legs.push(leg);
      this.bodyRoot.add(leg);
    }
  }

  private addTail(coat: THREE.Material, dark: THREE.Material): void {
    const segmentMaterials = [coat, coat, dark, coat] as const;
    let parent = this.bodyRoot;
    for (let index = 0; index < segmentMaterials.length; index++) {
      const joint = new THREE.Group();
      joint.position.set(0, index === 0 ? 0.68 : 0, index === 0 ? 0.67 : 0.25);
      const segment = this.createBox(
        0.13 - index * 0.015,
        0.13 - index * 0.015,
        0.32,
        segmentMaterials[index],
      );
      segment.position.z = 0.16;
      joint.add(segment);
      parent.add(joint);
      this.tailJoints.push(joint);
      parent = joint;
    }
  }

  private createBox(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  public override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    this.animationTime += deltaSeconds;

    const stateId = this.getBehaviorStateId();
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const isPouncing = stateId === 'pouncing';
    const isLunging = isPouncing && speed > this.walkSpeed;
    const isCrouched = stateId === 'stalking' || stateId === 'circling' || isPouncing;
    const blend = Math.min(1, deltaSeconds * LEOPARD_CONFIG.animationBlendSpeed);
    const gaitSpeed = speed > this.walkSpeed
      ? LEOPARD_CONFIG.runGaitSpeed
      : LEOPARD_CONFIG.gaitSpeed;
    const gaitPhase = this.animationTime * gaitSpeed;
    const gaitAmount = Math.min(0.72, speed * 0.15);

    const bodyTargetY = isCrouched ? -0.08 : 0;
    const bodyBob = speed > 0.05 ? Math.abs(Math.sin(gaitPhase)) * 0.025 : 0;
    this.bodyRoot.position.y += (bodyTargetY + bodyBob - this.bodyRoot.position.y) * blend;
    const bodyPitch = isLunging ? -0.14 : stateId === 'recovering' ? 0.09 : 0;
    this.bodyRoot.rotation.x += (bodyPitch - this.bodyRoot.rotation.x) * blend;

    const headDrop = isCrouched ? -0.09 : 0;
    this.headRoot.position.y += (
      LEOPARD_POSE.headY + headDrop - this.headRoot.position.y
    ) * blend;
    const headPitch = isPouncing ? 0.16 : stateId === 'circling' ? 0.08 : 0;
    this.headRoot.rotation.x += (headPitch - this.headRoot.rotation.x) * blend;

    for (let index = 0; index < this.legs.length; index++) {
      let targetRotation = 0;
      if (isLunging) {
        targetRotation = index < 2 ? 1.05 : -0.72;
      } else if (speed > 0.05) {
        const diagonalOffset = index === 0 || index === 3 ? 0 : Math.PI;
        targetRotation = Math.sin(gaitPhase + diagonalOffset) * gaitAmount;
      }
      this.legs[index].rotation.x += (
        targetRotation - this.legs[index].rotation.x
      ) * blend;
    }

    const tailEnergy = stateId === 'circling' ? 0.32 : 0.2;
    for (let index = 0; index < this.tailJoints.length; index++) {
      const targetYaw = Math.sin(this.animationTime * 3.2 - index * 0.55)
        * tailEnergy
        * (1 + index * 0.16);
      this.tailJoints[index].rotation.y += (
        targetYaw - this.tailJoints[index].rotation.y
      ) * blend;
    }
  }
}
