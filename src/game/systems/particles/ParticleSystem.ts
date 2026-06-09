import * as THREE from 'three';
import { Particle } from './Particle';
import { ParticlePool } from './ParticlePool';
import { getBlockProperties, BLOCK_TYPES } from '../../world/BlockConfig';

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
