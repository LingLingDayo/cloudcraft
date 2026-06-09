import * as THREE from 'three';
import { Particle } from '../Particle';

export class GlassShardParticle extends Particle {
  private rotationSpeed = new THREE.Vector3();

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
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4
      )
    );

    this.velocity.set(
      (Math.random() - 0.5) * 3.5,
      Math.random() * 2.5 + 1.2,
      (Math.random() - 0.5) * 3.5
    );

    this.maxLife = Math.random() * 0.3 + 0.25; // 0.25s ~ 0.55s

    this.rotationSpeed.set(
      (Math.random() - 0.5) * 16.0,
      (Math.random() - 0.5) * 16.0,
      (Math.random() - 0.5) * 16.0
    );
    // 玻璃碎片长宽各异，但厚度为扁平状
    this.mesh.scale.set(Math.random() * 0.8 + 0.4, Math.random() * 0.8 + 0.4, 0.15);
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    const gravity = -24.0;
    this.velocity.y += gravity * dt;
    this.mesh.position.addScaledVector(this.velocity, dt);

    this.mesh.rotation.x += this.rotationSpeed.x * dt;
    this.mesh.rotation.y += this.rotationSpeed.y * dt;
    this.mesh.rotation.z += this.rotationSpeed.z * dt;

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1.0 - this.age / this.maxLife) * 0.9;
    return true;
  }
}
