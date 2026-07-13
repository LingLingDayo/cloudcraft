import type { HotbarItem } from '@store/types';
import { ItemType } from '@type';

const CHEST_SLOT_COUNT = 27;
const VALID_ITEM_TYPES = new Set<string>(Object.values(ItemType));

interface ChestBlockEntitySnapshot extends Record<string, unknown> {
  readonly inventory: readonly (HotbarItem | null)[];
}

interface LeverBlockEntitySnapshot extends Record<string, unknown> {
  readonly active: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertChestBlockEntitySnapshot(
  data: Record<string, unknown>,
): asserts data is ChestBlockEntitySnapshot {
  if (!Array.isArray(data.inventory) || data.inventory.length !== CHEST_SLOT_COUNT) {
    throw new Error(`Chest block entity inventory must contain ${CHEST_SLOT_COUNT} slots`);
  }
  for (const stack of data.inventory) {
    if (stack === null) continue;
    if (
      !isRecord(stack)
      || typeof stack.type !== 'string'
      || !VALID_ITEM_TYPES.has(stack.type)
      || !Number.isInteger(stack.count)
      || Number(stack.count) <= 0
    ) {
      throw new Error('Chest block entity inventory contains an invalid item stack');
    }
  }
}

export function assertLeverBlockEntitySnapshot(
  data: Record<string, unknown>,
): asserts data is LeverBlockEntitySnapshot {
  if (typeof data.active !== 'boolean') {
    throw new Error('Lever block entity active state must be boolean');
  }
}

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

  public abstract toJSON(): Record<string, unknown>;
  public abstract fromJSON(data: Record<string, unknown>): void;
}

export class ChestBlockEntity extends BlockEntity {
  public inventory: (HotbarItem | null)[];

  constructor(x: number, y: number, z: number) {
    super(x, y, z, 'chest');
    this.inventory = Array(CHEST_SLOT_COUNT).fill(null);
  }

  public toJSON() {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      z: this.z,
      inventory: this.inventory.map(stack => stack ? { ...stack } : null),
    };
  }

  public fromJSON(data: Record<string, unknown>): void {
    assertChestBlockEntitySnapshot(data);
    this.inventory = data.inventory.map(item => item ? { ...item } : null);
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

  public fromJSON(data: Record<string, unknown>): void {
    assertLeverBlockEntitySnapshot(data);
    this.active = data.active;
  }
}
