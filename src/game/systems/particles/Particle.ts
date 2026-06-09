import * as THREE from 'three';

export abstract class Particle {
  public mesh!: THREE.Mesh;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public age = 0;
  public maxLife = 1.0;
  public isDead = false;

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
  }

  public abstract init(position: THREE.Vector3, colorHex: number | string): void;

  public abstract update(dt: number): boolean;

  public reset() {
    this.age = 0;
    this.isDead = false;
  }
}
