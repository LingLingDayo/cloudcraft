import * as THREE from 'three';
import { getBlockProperties, BLOCK_TYPES } from '../world/BlockConfig';

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

// ─── 1. 标准方块破碎粒子 ──────────────────────────────────
export class BlockBreakParticle extends Particle {
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
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      )
    );

    this.velocity.set(
      (Math.random() - 0.5) * 4.5,
      Math.random() * 4.5 + 2.0, // 初始垂直向上力
      (Math.random() - 0.5) * 4.5
    );

    this.maxLife = Math.random() * 0.35 + 0.35; // 0.35s ~ 0.7s
    this.mesh.scale.set(1.0, 1.0, 1.0);
    this.mesh.rotation.set(0, 0, 0);
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    const gravity = -18;
    this.velocity.y += gravity * dt;
    this.mesh.position.addScaledVector(this.velocity, dt);

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1.0 - this.age / this.maxLife) * 0.9;
    return true;
  }
}

// ─── 2. 落叶粒子（具有正弦飘落轨迹和低重力） ────────────────
export class LeafFallParticle extends Particle {
  private baseRotationSpeed = new THREE.Vector3();
  private windFrequency = 0;
  private windAmplitude = 0;
  private phaseOffset = 0;

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
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.8
      )
    );

    this.velocity.set(
      (Math.random() - 0.5) * 1.0,
      Math.random() * 0.5 - 0.2, // 几乎无向上的力
      (Math.random() - 0.5) * 1.0
    );

    this.maxLife = Math.random() * 1.5 + 1.5; // 1.5s ~ 3.0s

    this.baseRotationSpeed.set(
      (Math.random() - 0.5) * 2.0,
      Math.random() * 3.0 + 1.0,
      (Math.random() - 0.5) * 2.0
    );
    this.windFrequency = Math.random() * 3 + 2;
    this.windAmplitude = Math.random() * 1.2 + 0.6;
    this.phaseOffset = Math.random() * Math.PI * 2;

    this.mesh.scale.set(1.0, 1.0, 1.0);
    this.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      0
    );
  }

  public update(dt: number): boolean {
    this.age += dt;
    if (this.age >= this.maxLife) {
      return false;
    }

    const gravity = -3.0; // 轻飘飘下落
    this.velocity.y += gravity * dt;
    this.velocity.x *= 0.95;
    this.velocity.z *= 0.95;

    // 水平方向的正弦风力摇曳
    const wave = Math.sin(this.age * this.windFrequency + this.phaseOffset) * this.windAmplitude;
    const moveVec = this.velocity.clone().add(new THREE.Vector3(wave, 0, 0));
    this.mesh.position.addScaledVector(moveVec, dt);

    this.mesh.rotation.x += this.baseRotationSpeed.x * dt;
    this.mesh.rotation.y += this.baseRotationSpeed.y * dt;
    this.mesh.rotation.z += Math.sin(this.age * 4) * 0.5 * dt;

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1.0 - this.age / this.maxLife) * 0.9;
    return true;
  }
}

// ─── 3. 草屑粒子（形状扁长，具有旋转飘动轨迹） ────────────────
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

// ─── 4. 沙尘粒子（高空气阻力，缓慢向四周弥散膨胀并淡出） ──────
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

// ─── 5. 玻璃碎片粒子（高重力，高旋转） ──────────────────────
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

// ─── 6. 烟雾粒子（向上浮动并膨胀消散） ──────────────────────
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

// ─── 7. 受伤/暴击粒子（血色，高溅射初速度） ───────────────────
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

// ─── 8. 嘴部进食粒子 ───────────────────────────────────────
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

// ─── 9. 对象池系统 (Object Pool) ──────────────────────────
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
      case 'webcraft:leaf':
        p = new LeafFallParticle(this.planeGeom);
        break;
      case 'webcraft:grass':
        p = new GrassBreakParticle(this.planeGeom);
        break;
      case 'webcraft:sand':
        p = new SandDustParticle(this.boxGeom);
        break;
      case 'webcraft:glass':
        p = new GlassShardParticle(this.planeGeom);
        break;
      case 'webcraft:smoke':
        p = new SmokeParticle(this.boxGeom);
        break;
      case 'webcraft:crit':
        p = new CritParticle(this.boxGeom);
        break;
      case 'webcraft:eat':
        p = new EatParticle(this.boxGeom);
        break;
      case 'webcraft:block_break':
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

// ─── 10. 粒子系统管理器 (ParticleSystem) ────────────────────
export class ParticleSystem {
  private activeParticles: { particle: Particle; type: string }[] = [];
  private pool: ParticlePool;

  // 限制最大活跃粒子数以避免极端情况下的内存和渲染压力
  private readonly maxActiveCount = 350;

  constructor(scene: THREE.Scene) {
    this.pool = new ParticlePool(scene);
  }

  /**
   * 通用粒子发射入口。支持从异质对象池中借出粒子并激活。
   */
  public spawn(type: string, position: THREE.Vector3, colorHex: number | string, count = 12) {
    for (let i = 0; i < count; i++) {
      // 达到硬性上限时，强制回收最老的粒子，保证物理引擎与渲染始终流畅
      if (this.activeParticles.length >= this.maxActiveCount) {
        const oldest = this.activeParticles.shift()!;
        this.pool.release(oldest.type, oldest.particle);
      }

      const p = this.pool.get(type);
      p.init(position, colorHex);
      this.activeParticles.push({ particle: p, type });
    }
  }

  /**
   * 自动解析方块材质并分发特定粒子效果的高级接口。
   * 外接解耦的核心扩展入口：根据 BlockProperties 中的 particleEffect 属性匹配最合适的粒子效果。
   */
  public spawnBlockParticles(position: THREE.Vector3, blockId: number, count = 12) {
    const cleanId = blockId & 0x3F;
    const props = getBlockProperties(cleanId);
    const effectType = props.particleEffect ?? 'webcraft:block_break';

    if (cleanId === BLOCK_TYPES.GRASS) {
      // 混合草色和泥土色立方体碎片，极大提升草方块破坏效果的真实感
      const grassColor = 0x56a032;
      const dirtColor = 0x825a3c;
      const grassCount = Math.floor(count * 0.35);
      const dirtCount = count - grassCount;

      this.spawn('webcraft:block_break', position, grassColor, grassCount);
      this.spawn('webcraft:block_break', position, dirtColor, dirtCount);
    } else {
      const color = props.colorHex ?? 0x787878;
      this.spawn(effectType, position, color, count);
    }
  }

  /**
   * 每帧 Tick 调用，更新所有活跃粒子的物理运算与材质状态。
   */
  public update(dt: number) {
    // 限制帧率突变导致 dt 异常变大时的物理跳跃
    const clampedDt = Math.min(dt, 0.1);

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const item = this.activeParticles[i];
      const alive = item.particle.update(clampedDt);

      if (!alive) {
        this.pool.release(item.type, item.particle);
        this.activeParticles.splice(i, 1);
      }
    }
  }

  public clear() {
    for (const item of this.activeParticles) {
      this.pool.release(item.type, item.particle);
    }
    this.activeParticles = [];
    this.pool.clear();
  }
}
