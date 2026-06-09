import * as THREE from 'three';
import { Particle } from '../Particle';

export class CritParticle extends Particle {
  constructor(geom: THREE.BufferGeometry) {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
    });
    super(geom, mat);
  }

  public init(position: THREE.Vector3, colorHex: number | string) {
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(colorHex);
    mat.opacity = 0.95;

    this.mesh.position.copy(position);

    this.velocity.set(
      (Math.random() - 0.5) * 5.5,
      Math.random() * 3.5 + 1.5,
      (Math.random() - 0.5) * 5.5
    );

    this.maxLife = Math.random() * 0.25 + 0.2; // 0.2s ~ 0.45s
    this.mesh.scale.set(1.0, 1.0, 1.0);
    this.mesh.rotation.set(0, 0, 0);
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    const gravity = -17.0;
    this.velocity.y += gravity * dt;
    this.mesh.position.addScaledVector(this.velocity, dt);

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1.0 - this.age / this.maxLife) * 0.95;
    return true;
  }
}
