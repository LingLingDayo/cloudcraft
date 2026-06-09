import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';
import { ParticlePool } from './ParticlePool';
import { BlockBreakParticle } from './impl/BlockBreakParticle';
import { SmokeParticle } from './impl/SmokeParticle';
import { BLOCK_TYPES } from '../../world/BlockConfig';

// Mock WorldConfig or BlockConfig if needed, but in webcraft it uses real implementation
// We create a mock scene so scene.add() and scene.remove() won't throw
class MockScene extends THREE.Scene {
  public addedObjects: THREE.Object3D[] = [];
  public override add(...object: THREE.Object3D[]) {
    this.addedObjects.push(...object);
    return this;
  }
  public override remove(...object: THREE.Object3D[]) {
    this.addedObjects = this.addedObjects.filter(o => !object.includes(o));
    return this;
  }
}

describe('Particles System Refactored', () => {
  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
  });

  describe('ParticlePool', () => {
    it('should create new particle instance when pool is empty', () => {
      const pool = new ParticlePool(scene);
      const particle = pool.get('webcraft:smoke');

      expect(particle).toBeInstanceOf(SmokeParticle);
      expect(particle.mesh.visible).toBe(true);
      expect(scene.addedObjects).toContain(particle.mesh);
    });

    it('should recycle particle instances on release and get', () => {
      const pool = new ParticlePool(scene);
      const p1 = pool.get('webcraft:smoke');
      expect(p1.mesh.visible).toBe(true);

      // Release particle
      pool.release('webcraft:smoke', p1);
      expect(p1.mesh.visible).toBe(false);

      // Get again - should be same instance
      const p2 = pool.get('webcraft:smoke');
      expect(p2).toBe(p1);
      expect(p2.mesh.visible).toBe(true);
    });

    it('should handle different particle types correctly', () => {
      const pool = new ParticlePool(scene);
      const smoke = pool.get('webcraft:smoke');
      const breakPart = pool.get('webcraft:block_break');

      expect(smoke).toBeInstanceOf(SmokeParticle);
      expect(breakPart).toBeInstanceOf(BlockBreakParticle);
    });
  });

  describe('ParticleSystem', () => {
    it('should spawn correct number of particles and update their lifecycle', () => {
      const system = new ParticleSystem(scene);
      const pos = new THREE.Vector3(0, 0, 0);

      system.spawn('webcraft:smoke', pos, 0xffffff, 5);

      // Active particles list is private, but we can verify through scene count and tick update
      expect(scene.addedObjects.length).toBe(5);

      // All of them should be visible
      scene.addedObjects.forEach(obj => {
        expect(obj.visible).toBe(true);
      });

      // Update system with small DT (particles have maxLife ~0.35s - 0.7s)
      system.update(0.05);
      // Still visible
      scene.addedObjects.forEach(obj => {
        expect(obj.visible).toBe(true);
      });

      // Update multiple times to expire them, since dt is clamped to max 0.1s per tick
      for (let i = 0; i < 20; i++) {
        system.update(0.1);
      }

      // All expired particles should be released (hidden)
      scene.addedObjects.forEach(obj => {
        expect(obj.visible).toBe(false);
      });
    });

    it('should enforce maximum active particles count', () => {
      const system = new ParticleSystem(scene);
      const pos = new THREE.Vector3(0, 0, 0);

      // Max active is 350
      system.spawn('webcraft:smoke', pos, 0xffffff, 400);

      // Verify that excess particles are recycled and active objects count is bounded
      // Since objects are not immediately removed from scene (they are set visible = false and stored in pool),
      // we check how many are visible (active).
      const visibleCount = scene.addedObjects.filter(obj => obj.visible).length;
      expect(visibleCount).toBeLessThanOrEqual(350);
    });

    it('should spawn block break particles correctly', () => {
      const system = new ParticleSystem(scene);
      const pos = new THREE.Vector3(1, 2, 3);

      // Spawn for ordinary stone block
      system.spawnBlockParticles(pos, BLOCK_TYPES.STONE, 10);
      let visibleCount = scene.addedObjects.filter(obj => obj.visible).length;
      expect(visibleCount).toBe(10);

      // Clear system
      system.clear();
      visibleCount = scene.addedObjects.filter(obj => obj.visible).length;
      expect(visibleCount).toBe(0);

      // Spawn for grass block (which should trigger a mixture of grass and dirt colors)
      system.spawnBlockParticles(pos, BLOCK_TYPES.GRASS, 10);
      visibleCount = scene.addedObjects.filter(obj => obj.visible).length;
      expect(visibleCount).toBe(10);
    });
  });
});
