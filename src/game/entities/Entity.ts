import * as THREE from 'three';
import { World } from '@game/world/World';

export interface SerializedEntityData {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  isPersistent: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customData?: Record<string, any>;
}

export abstract class Entity {
  public id: string;
  public type: string;
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public life: number;
  public maxLife: number;
  public isDead = false;
  public isPersistent = false;
  protected world: World;

  constructor(id: string, type: string, spawnPos: THREE.Vector3, world: World, maxLife = 10) {
    this.id = id;
    this.type = type;
    this.position.copy(spawnPos);
    this.world = world;
    this.maxLife = maxLife;
    this.life = maxLife;
  }

  public serialize(): SerializedEntityData {
    return {
      id: this.id,
      type: this.type,
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      vx: this.velocity.x,
      vy: this.velocity.y,
      vz: this.velocity.z,
      life: this.life,
      maxLife: this.maxLife,
      isPersistent: this.isPersistent,
      customData: this.serializeCustomData()
    };
  }

  public deserialize(data: SerializedEntityData): void {
    if (data.id) this.id = data.id;
    if (data.type) this.type = data.type;
    this.position.set(data.x, data.y, data.z);
    this.velocity.set(data.vx || 0, data.vy || 0, data.vz || 0);
    this.life = data.life ?? this.maxLife;
    this.maxLife = data.maxLife ?? 10;
    this.isPersistent = !!data.isPersistent;
    this.isDead = this.life <= 0;
    if (data.customData) {
      this.deserializeCustomData(data.customData);
    }
  }

  public abstract update(dt: number): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected serializeCustomData(): Record<string, any> | undefined {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected deserializeCustomData(_customData: Record<string, any>): void {
    // To be overridden by subclasses if needed
  }
}
