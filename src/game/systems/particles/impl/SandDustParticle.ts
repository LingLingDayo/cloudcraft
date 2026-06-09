import * as THREE from 'three';
import { Particle } from '../Particle';

export class SandDustParticle extends Particle {
  constructor(geom: THREE.BufferGeometry) {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
    });
    super(geom, mat);
  }

  public init(position: THREE.Vector3, colorHex: number | string) {
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(colorHex);
    mat.opacity = 0.85;

    this.mesh.position.copy(position).add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3
      )
    );

    // 均匀向外扩散
    this.velocity.set(
      (Math.random() - 0.5) * 1.8,
      (Math.random() - 0.5) * 1.5 + 0.3,
      (Math.random() - 0.5) * 1.8
    );

    this.maxLife = Math.random() * 0.3 + 0.3; // 0.3s ~ 0.6s
    this.mesh.scale.set(1.0, 1.0, 1.0);
    this.mesh.rotation.set(0, 0, 0);
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    const gravity = -2.0; // 极弱的重力
    this.velocity.y += gravity * dt;
    this.velocity.multiplyScalar(0.91); // 空气粘性大
    this.mesh.position.addScaledVector(this.velocity, dt);

    const ratio = 1.0 - this.age / this.maxLife;
    this.mesh.scale.setScalar(ratio); // 随消亡而缩小

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = ratio * 0.85;
    return true;
  }
}
