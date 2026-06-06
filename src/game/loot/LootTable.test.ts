import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { ItemType } from '@type';
import { World } from '@game/world/World';
import {
  LootTable,
  LootPool,
  LootEntry,
  RandomChanceLootCondition,
  KilledByPlayerLootCondition,
  SetCountLootFunction
} from './LootTable';
import type { LootContext } from './LootTable';
import { LootTableRegistry } from './LootTableRegistry';

describe('Loot Table Engine', () => {
  const dummyWorld = {} as unknown as World;
  const dummyPos = new THREE.Vector3();

  test('should register and retrieve loot tables from registry', () => {
    const table = new LootTable([
      new LootPool(1, [new LootEntry(ItemType.DIAMOND)])
    ]);
    const testId = 'webcraft:blocks/test_custom_block';
    
    LootTableRegistry.register(testId, table);
    const retrieved = LootTableRegistry.get(testId);
    
    expect(retrieved).toBe(table);
  });

  test('should evaluate roll counts correctly', () => {
    // Pool with 3 fixed rolls
    const pool = new LootPool(3, [new LootEntry(ItemType.STONE)]);
    const table = new LootTable([pool]);
    const context: LootContext = { world: dummyWorld, position: dummyPos };

    const drops = table.generateLoot(context);
    expect(drops).toHaveLength(3);
    expect(drops.every(d => d.type === ItemType.STONE && d.count === 1)).toBe(true);
  });

  test('should apply SetCount function correctly', () => {
    const entry = new LootEntry(
      ItemType.COAL,
      1,
      [],
      [new SetCountLootFunction(5, 10)]
    );
    const pool = new LootPool(1, [entry]);
    const table = new LootTable([pool]);
    const context: LootContext = { world: dummyWorld, position: dummyPos };

    const drops = table.generateLoot(context);
    expect(drops).toHaveLength(1);
    expect(drops[0].type).toBe(ItemType.COAL);
    expect(drops[0].count).toBeGreaterThanOrEqual(5);
    expect(drops[0].count).toBeLessThanOrEqual(10);
  });

  test('should respect RandomChance condition', () => {
    const poolAlways = new LootPool(1, [new LootEntry(ItemType.DIRT)], [new RandomChanceLootCondition(1.0)]);
    const poolNever = new LootPool(1, [new LootEntry(ItemType.GRASS)], [new RandomChanceLootCondition(0.0)]);
    const table = new LootTable([poolAlways, poolNever]);
    const context: LootContext = { world: dummyWorld, position: dummyPos };

    const drops = table.generateLoot(context);
    expect(drops.some(d => d.type === ItemType.DIRT)).toBe(true);
    expect(drops.some(d => d.type === ItemType.GRASS)).toBe(false);
  });

  test('should respect KilledByPlayer condition', () => {
    const pool = new LootPool(
      1,
      [new LootEntry(ItemType.PORKCHOP)],
      [new KilledByPlayerLootCondition()]
    );
    const table = new LootTable([pool]);

    const fakePlayer = { isPlayer: true };
    const fakeZombie = { constructor: { name: 'Zombie' } };

    // 1. Without player killer -> drops nothing
    const contextNoPlayer: LootContext = { world: dummyWorld, position: dummyPos, killer: fakeZombie };
    expect(table.generateLoot(contextNoPlayer)).toHaveLength(0);

    // 2. With player killer -> drops porkchop
    const contextWithPlayer: LootContext = { world: dummyWorld, position: dummyPos, killer: fakePlayer };
    const drops = table.generateLoot(contextWithPlayer);
    expect(drops).toHaveLength(1);
    expect(drops[0].type).toBe(ItemType.PORKCHOP);
  });

  test('should select entries based on weights', () => {
    // 100% chance for entry A with weight 10, entry B with weight 0
    const entryA = new LootEntry(ItemType.DIAMOND, 10);
    const entryB = new LootEntry(ItemType.GLASS, 0);
    const pool = new LootPool(1, [entryA, entryB]);
    const table = new LootTable([pool]);
    const context: LootContext = { world: dummyWorld, position: dummyPos };

    const drops = table.generateLoot(context);
    expect(drops).toHaveLength(1);
    expect(drops[0].type).toBe(ItemType.DIAMOND);
  });
});
