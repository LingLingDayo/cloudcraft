import * as THREE from 'three';
import { Particle } from '../Particle';

export class SmokeParticle extends Particle {
  constructor(geom: THREE.BufferGeometry) {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.9,
    });
    super(geom, mat);
  }

  public init(position: THREE.Vector3, colorHex: number | string) {
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(colorHex);
    mat.opacity = 0.9;

    this.mesh.position.copy(position).add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3
      )
    );

    this.velocity.set(
      (Math.random() - 0.5) * 1.0,
      Math.random() * 0.7 + 0.5, // 向上浮动
      (Math.random() - 0.5) * 1.0
    );

    this.maxLife = Math.random() * 0.35 + 0.35; // 0.35s ~ 0.7s
    this.mesh.scale.set(0.5, 0.5, 0.5); // 初始小
    this.mesh.rotation.set(0, 0, 0);
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    this.velocity.multiplyScalar(0.93);
    this.mesh.position.addScaledVector(this.velocity, dt);

    const ratio = this.age / this.maxLife;
    const size = 0.5 + ratio * 1.3; // 逐渐膨胀
    this.mesh.scale.setScalar(size);

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1.0 - ratio) * 0.9;
    return true;
  }
}
