import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private geom: THREE.BoxGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geom = new THREE.BoxGeometry(0.15, 0.15, 0.15);
  }

  public spawn(position: THREE.Vector3, colorHex: number | string, count = 12) {
    const color = new THREE.Color(colorHex);

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
      });

      const mesh = new THREE.Mesh(this.geom, mat);

      // Distribute randomly in a small cube around position
      mesh.position.copy(position).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6
        )
      );

      // Random projectile velocities (fanning outward and upward)
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4.5,
        Math.random() * 4.5 + 2.0, // Initial vertical boost
        (Math.random() - 0.5) * 4.5
      );

      const life = Math.random() * 0.35 + 0.35; // 0.35s to 0.70s

      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life, maxLife: life });
    }
  }

  public update(dt: number) {
    const gravity = -18; // constant falling acceleration

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      // Handle expiration
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        // Do not dispose the shared this.geom, only dispose materials to prevent memory leak
        if (Array.isArray(p.mesh.material)) {
          p.mesh.material.forEach((m) => m.dispose());
        } else {
          p.mesh.material.dispose();
        }
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.velocity.y += gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Fade opacity proportionally
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (p.life / p.maxLife) * 0.9;
    }
  }

  public clear() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      if (Array.isArray(p.mesh.material)) {
        p.mesh.material.forEach((m) => m.dispose());
      } else {
        p.mesh.material.dispose();
      }
    }
    this.particles = [];
  }
}
