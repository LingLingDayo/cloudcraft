import { ItemType } from '@type';
import {
  LootTable,
  LootPool,
  LootEntry,
  RandomChanceLootCondition,
  SetCountLootFunction
} from './LootTable';

export class LootTableRegistry {
  private static registry = new Map<string, LootTable>();
  private static initialized = false;

  public static register(id: string, table: LootTable): void {
    this.registry.set(id, table);
  }

  public static get(id: string): LootTable | null {
    this.ensureInitialized();
    return this.registry.get(id) ?? null;
  }

  private static ensureInitialized() {
    if (!this.initialized) {
      this.init();
    }
  }

  public static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // ─── 注册生物战利品表 ───────────────────────────────────────

    // 猪的掉落物：1-3 个生猪肉
    this.register(
      'webcraft:entities/pig',
      new LootTable([
        new LootPool(
          1,
          [
            new LootEntry(
              ItemType.PORKCHOP,
              1,
              [],
              [new SetCountLootFunction(1, 3)]
            )
          ]
        )
      ])
    );

    // ─── 注册方块战利品表 ───────────────────────────────────────

    // 橡树树叶：10% 掉落树苗，5% 掉落苹果
    this.register(
      'webcraft:blocks/oak_leaves',
      new LootTable([
        new LootPool(1, [new LootEntry(ItemType.OAK_SAPLING)], [new RandomChanceLootCondition(0.1)]),
        new LootPool(1, [new LootEntry(ItemType.APPLE)], [new RandomChanceLootCondition(0.05)])
      ])
    );

    // 桦树树叶：10% 掉落桦木树苗
    this.register(
      'webcraft:blocks/birch_leaves',
      new LootTable([
        new LootPool(1, [new LootEntry(ItemType.BIRCH_SAPLING)], [new RandomChanceLootCondition(0.1)])
      ])
    );

    // 松树树叶：10% 掉落松树树苗
    this.register(
      'webcraft:blocks/spruce_leaves',
      new LootTable([
        new LootPool(1, [new LootEntry(ItemType.SPRUCE_SAPLING)], [new RandomChanceLootCondition(0.1)])
      ])
    );

    // 丛林树叶：10% 掉落丛林树苗
    this.register(
      'webcraft:blocks/jungle_leaves',
      new LootTable([
        new LootPool(1, [new LootEntry(ItemType.JUNGLE_SAPLING)], [new RandomChanceLootCondition(0.1)])
      ])
    );

    // 草丛：10% 概率掉落种子
    this.register(
      'webcraft:blocks/tall_grass',
      new LootTable([
        new LootPool(1, [new LootEntry(ItemType.SEED)], [new RandomChanceLootCondition(0.1)])
      ])
    );

    // 双格高草：10% 概率掉落种子
    this.register(
      'webcraft:blocks/double_tall_grass_bottom',
      new LootTable([
        new LootPool(1, [new LootEntry(ItemType.SEED)], [new RandomChanceLootCondition(0.1)])
      ])
    );
    this.register(
      'webcraft:blocks/double_tall_grass_top',
      new LootTable([
        new LootPool(1, [new LootEntry(ItemType.SEED)], [new RandomChanceLootCondition(0.1)])
      ])
    );

    // 双层花朵顶部掉落对应的物品
    this.register('webcraft:blocks/sunflower_top', this.createSimpleBlockLootTable(ItemType.SUNFLOWER));
    this.register('webcraft:blocks/rose_bush_top', this.createSimpleBlockLootTable(ItemType.ROSE_BUSH));
    this.register('webcraft:blocks/peony_top', this.createSimpleBlockLootTable(ItemType.PEONY));
    this.register('webcraft:blocks/lilac_top', this.createSimpleBlockLootTable(ItemType.LILAC));
  }

  /**
   * 辅助方法：快速创建一个只以 100% 概率掉落 1 个自身物品的 LootTable
   */
  public static createSimpleBlockLootTable(itemType: ItemType): LootTable {
    return new LootTable([
      new LootPool(1, [new LootEntry(itemType)])
    ]);
  }
}

// 自动初始化
LootTableRegistry.init();
