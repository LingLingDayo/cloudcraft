import * as THREE from 'three';
import { ItemType, type ItemStack } from '@type';
import type { World } from '../world/World';

export interface LootContext {
  world: World;
  position: THREE.Vector3;
  tool?: unknown;   // 挖掘/攻击时手持的物品/工具
  killer?: unknown; // 击杀者实体
}

export interface LootCondition {
  test(context: LootContext): boolean;
}

export interface LootFunction {
  apply(stack: ItemStack, context: LootContext): ItemStack;
}

// ─── 常用战利品条件 (Loot Conditions) ───────────────────────────

/**
 * 随机概率判定条件
 */
export class RandomChanceLootCondition implements LootCondition {
  private chance: number;

  constructor(chance: number) {
    this.chance = chance;
  }

  test(_context: LootContext): boolean {
    return Math.random() < this.chance;
  }
}

/**
 * 仅由玩家击杀判定条件
 */
export class KilledByPlayerLootCondition implements LootCondition {
  test(context: LootContext): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const killer = context.killer as any;
    return killer?.constructor?.name === 'Player' || killer?.isPlayer === true;
  }
}

/**
 * 工具匹配判定条件
 */
export class MatchToolLootCondition implements LootCondition {
  private predicate: (tool: unknown) => boolean;

  constructor(predicate: (tool: unknown) => boolean) {
    this.predicate = predicate;
  }

  test(context: LootContext): boolean {
    return !!context.tool && this.predicate(context.tool);
  }
}

// ─── 常用战利品修饰函数 (Loot Functions) ────────────────────────

/**
 * 设置掉落堆叠的数量（支持区间随机）
 */
export class SetCountLootFunction implements LootFunction {
  private min: number;
  private max: number;

  constructor(min: number, max: number = min) {
    this.min = min;
    this.max = max;
  }

  apply(stack: ItemStack, _context: LootContext): ItemStack {
    const count = this.min === this.max
      ? this.min
      : this.min + Math.floor(Math.random() * (this.max - this.min + 1));
    return { ...stack, count };
  }
}

// ─── 核心数据模型 (Loot Structure Models) ───────────────────────

export class LootEntry {
  public itemType: ItemType;
  public weight: number;
  public conditions: LootCondition[];
  public functions: LootFunction[];

  constructor(
    itemType: ItemType,
    weight: number = 1,
    conditions: LootCondition[] = [],
    functions: LootFunction[] = []
  ) {
    this.itemType = itemType;
    this.weight = weight;
    this.conditions = conditions;
    this.functions = functions;
  }

  public testConditions(context: LootContext): boolean {
    return this.conditions.every(c => c.test(context));
  }

  public applyFunctions(stack: ItemStack, context: LootContext): ItemStack {
    let current = stack;
    for (const fn of this.functions) {
      current = fn.apply(current, context);
    }
    return current;
  }
}

export class LootPool {
  public rolls: number | { min: number; max: number };
  public entries: LootEntry[];
  public conditions: LootCondition[];
  public functions: LootFunction[];

  constructor(
    rolls: number | { min: number; max: number } = 1,
    entries: LootEntry[] = [],
    conditions: LootCondition[] = [],
    functions: LootFunction[] = []
  ) {
    this.rolls = rolls;
    this.entries = entries;
    this.conditions = conditions;
    this.functions = functions;
  }

  public generateLoot(context: LootContext, out: ItemStack[]): void {
    if (!this.conditions.every(c => c.test(context))) {
      return;
    }

    const rollCount = typeof this.rolls === 'number'
      ? this.rolls
      : this.rolls.min + Math.floor(Math.random() * (this.rolls.max - this.rolls.min + 1));

    for (let r = 0; r < rollCount; r++) {
      const candidates = this.entries.filter(e => e.testConditions(context));
      if (candidates.length === 0) continue;

      const totalWeight = candidates.reduce((sum, e) => sum + e.weight, 0);
      if (totalWeight <= 0) continue;

      let rng = Math.random() * totalWeight;
      let selectedEntry: LootEntry | null = null;
      for (const entry of candidates) {
        rng -= entry.weight;
        if (rng <= 0) {
          selectedEntry = entry;
          break;
        }
      }

      if (selectedEntry) {
        let stack: ItemStack = { type: selectedEntry.itemType, count: 1 };
        stack = selectedEntry.applyFunctions(stack, context);

        // 应用战利品池级函数
        for (const fn of this.functions) {
          stack = fn.apply(stack, context);
        }

        if (stack.count > 0) {
          out.push(stack);
        }
      }
    }
  }
}

export class LootTable {
  public pools: LootPool[];

  constructor(pools: LootPool[] = []) {
    this.pools = pools;
  }

  public generateLoot(context: LootContext): ItemStack[] {
    const out: ItemStack[] = [];
    for (const pool of this.pools) {
      pool.generateLoot(context, out);
    }
    return out;
  }
}
