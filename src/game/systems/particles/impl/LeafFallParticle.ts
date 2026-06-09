import * as THREE from 'three';
import { Particle } from '../Particle';

export class LeafFallParticle extends Particle {
  private baseRotationSpeed = new THREE.Vector3();
  private windFrequency = 0;
  private windAmplitude = 0;
  private phaseOffset = 0;

  constructor(geom: THREE.BufferGeometry) {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    super(geom, mat);
  }

  public init(position: THREE.Vector3, colorHex: number | string) {
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(colorHex);
    mat.opacity = 0.9;

    this.mesh.position.copy(position).add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.8
      )
    );

    this.velocity.set(
      (Math.random() - 0.5) * 1.0,
      Math.random() * 0.5 - 0.2,
      (Math.random() - 0.5) * 1.0
    );

    this.maxLife = Math.random() * 1.5 + 1.5; // 1.5s ~ 3.0s

    this.baseRotationSpeed.set(
      (Math.random() - 0.5) * 2.0,
      Math.random() * 3.0 + 1.0,
      (Math.random() - 0.5) * 2.0
    );
    this.windFrequency = Math.random() * 3 + 2;
    this.windAmplitude = Math.random() * 1.2 + 0.6;
    this.phaseOffset = Math.random() * Math.PI * 2;

    this.mesh.scale.set(1.0, 1.0, 1.0);
    this.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      0
    );
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    const gravity = -3.0; // 轻飘飘下落
    this.velocity.y += gravity * dt;
    this.velocity.x *= 0.95;
    this.velocity.z *= 0.95;

    // 水平方向的正弦风力摇曳
    const wave = Math.sin(this.age * this.windFrequency + this.phaseOffset) * this.windAmplitude;
    const moveVec = this.velocity.clone().add(new THREE.Vector3(wave, 0, 0));
    this.mesh.position.addScaledVector(moveVec, dt);

    this.mesh.rotation.x += this.baseRotationSpeed.x * dt;
    this.mesh.rotation.y += this.baseRotationSpeed.y * dt;
    this.mesh.rotation.z += Math.sin(this.age * 4) * 0.5 * dt;

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1.0 - this.age / this.maxLife) * 0.9;
    return true;
  }
}
