import * as THREE from 'three';
import { Particle } from './Particle';
import { BlockBreakParticle } from './impl/BlockBreakParticle';
import { LeafFallParticle } from './impl/LeafFallParticle';
import { GrassBreakParticle } from './impl/GrassBreakParticle';
import { SandDustParticle } from './impl/SandDustParticle';
import { GlassShardParticle } from './impl/GlassShardParticle';
import { SmokeParticle } from './impl/SmokeParticle';
import { CritParticle } from './impl/CritParticle';
import { EatParticle } from './impl/EatParticle';

export class ParticlePool {
  private pools = new Map<string, Particle[]>();
  private scene: THREE.Scene;
  private boxGeom: THREE.BoxGeometry;
  private planeGeom: THREE.PlaneGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // 实例化共享的几何体，所有粒子复用这两个几何体，彻底消除 Geometry 重复申请与 GC 开销
    this.boxGeom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.planeGeom = new THREE.PlaneGeometry(0.14, 0.14);
  }

  /**
   * 从对象池借出一个粒子实例。如果池内有闲置实例，则重用并激活；否则创建新实例。
   */
  public get(type: string): Particle {
    let pool = this.pools.get(type);
    if (!pool) {
      pool = [];
      this.pools.set(type, pool);
    }

    if (pool.length > 0) {
      const p = pool.pop()!;
      p.reset();
      p.mesh.visible = true;
      return p;
    }

    // 池空时创建，并将其直接加入场景，设为可见
    const p = this.createParticleInstance(type);
    p.mesh.visible = true;
    return p;
  }

  /**
   * 归还粒子到池中，隐藏网格以取消绘制。
   */
  public release(type: string, particle: Particle) {
    particle.mesh.visible = false;
    let pool = this.pools.get(type);
    if (!pool) {
      pool = [];
      this.pools.set(type, pool);
    }
    pool.push(particle);
  }

  private createParticleInstance(type: string): Particle {
    let p: Particle;
    switch (type) {
      case 'cloudcraft:leaf':
        p = new LeafFallParticle(this.planeGeom);
        break;
      case 'cloudcraft:grass':
        p = new GrassBreakParticle(this.planeGeom);
        break;
      case 'cloudcraft:sand':
        p = new SandDustParticle(this.boxGeom);
        break;
      case 'cloudcraft:glass':
        p = new GlassShardParticle(this.planeGeom);
        break;
      case 'cloudcraft:smoke':
        p = new SmokeParticle(this.boxGeom);
        break;
      case 'cloudcraft:crit':
        p = new CritParticle(this.boxGeom);
        break;
      case 'cloudcraft:eat':
        p = new EatParticle(this.boxGeom);
        break;
      case 'cloudcraft:block_break':
      default:
        p = new BlockBreakParticle(this.boxGeom);
        break;
    }

    // 在创建实例时，一次性加入场景，后续仅控制 visible 属性，带来绝对的 WebGL 状态更新性能优化
    this.scene.add(p.mesh);
    return p;
  }

  public clear() {
    this.pools.forEach((pool) => {
      pool.forEach((p) => {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        if (Array.isArray(p.mesh.material)) {
          p.mesh.material.forEach((m) => m.dispose());
        } else {
          p.mesh.material.dispose();
        }
      });
    });
    this.pools.clear();
    this.boxGeom.dispose();
    this.planeGeom.dispose();
  }
}
