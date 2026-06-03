/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HotbarItem } from '@store/types';

export abstract class BlockEntity {
  public readonly x: number;
  public readonly y: number;
  public readonly z: number;
  public readonly type: string;

  constructor(x: number, y: number, z: number, type: string) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.type = type;
  }

  public get key(): string {
    return `${this.x},${this.y},${this.z}`;
  }

  public abstract toJSON(): Record<string, any>;
  public abstract fromJSON(data: Record<string, any>): void;
}

export class ChestBlockEntity extends BlockEntity {
  public inventory: (HotbarItem | null)[];

  constructor(x: number, y: number, z: number) {
    super(x, y, z, 'chest');
    this.inventory = Array(27).fill(null);
  }

  public toJSON() {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      z: this.z,
      inventory: this.inventory,
    };
  }

  public fromJSON(data: Record<string, any>): void {
    if (Array.isArray(data.inventory)) {
      this.inventory = data.inventory.map(item => item ? { type: item.type, count: item.count } : null);
    }
  }
}

export class LeverBlockEntity extends BlockEntity {
  public active: boolean = false;

  constructor(x: number, y: number, z: number) {
    super(x, y, z, 'lever');
  }

  public toJSON() {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      z: this.z,
      active: this.active,
    };
  }

  public fromJSON(data: Record<string, any>): void {
    this.active = !!data.active;
  }
}
