import * as THREE from 'three';
import { Particle } from '../Particle';

export class GrassBreakParticle extends Particle {
  private rotationSpeed = 0;

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
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.6
      )
    );

    this.velocity.set(
      (Math.random() - 0.5) * 2.5,
      Math.random() * 2.0 + 1.0,
      (Math.random() - 0.5) * 2.5
    );

    this.maxLife = Math.random() * 0.5 + 0.5; // 0.5s ~ 1.0s
    this.rotationSpeed = (Math.random() - 0.5) * 12.0;

    // 调整为草叶般的窄条比例
    this.mesh.scale.set(1.3, 0.35, 1.0);
    this.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    const gravity = -9.8;
    this.velocity.y += gravity * dt;
    this.velocity.x *= 0.96;
    this.velocity.z *= 0.96;
    this.mesh.position.addScaledVector(this.velocity, dt);

    this.mesh.rotation.z += this.rotationSpeed * dt;
    this.mesh.rotation.x += this.rotationSpeed * 0.4 * dt;

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1.0 - this.age / this.maxLife) * 0.9;
    return true;
  }
}
