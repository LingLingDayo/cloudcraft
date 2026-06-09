import * as THREE from 'three';
import { Particle } from '../Particle';

export class EatParticle extends Particle {
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

    this.mesh.position.copy(position);

    // 吃东西的碎屑主要向下掉
    this.velocity.set(
      (Math.random() - 0.5) * 1.5,
      -Math.random() * 2.2 - 0.4,
      (Math.random() - 0.5) * 1.5
    );

    this.maxLife = Math.random() * 0.2 + 0.25; // 0.25s ~ 0.45s
    this.mesh.scale.set(0.6, 0.6, 0.6); // 较小碎屑
    this.mesh.rotation.set(0, 0, 0);
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    const gravity = -11.0;
    this.velocity.y += gravity * dt;
    this.mesh.position.addScaledVector(this.velocity, dt);

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1.0 - this.age / this.maxLife) * 0.9;
    return true;
  }
}
