import {
  Item,
  BlockItem,
  FoodItem,
  PlaceableFixtureItem,
  type ItemCategory,
} from './Item';
import { ItemType, BlockType, BLOCK_TYPES } from '@type';
import { BlockRegistry } from '@game/world/block/BlockRegistry';
import { CrossBlockModel } from '@game/world/block/BlockModel';

const WOOD_BLOCK_TYPES = new Set<BlockType>([
  BLOCK_TYPES.WOOD,
  BLOCK_TYPES.BIRCH_WOOD,
  BLOCK_TYPES.SPRUCE_WOOD,
  BLOCK_TYPES.JUNGLE_WOOD,
]);

const STONE_BLOCK_TYPES = new Set<BlockType>([
  BLOCK_TYPES.STONE,
  BLOCK_TYPES.SANDSTONE,
]);

export class ItemRegistry {
  private static items = new Map<ItemType, Item>();
  private static blockToItemMap = new Map<BlockType, ItemType>();
  private static itemToBlockMap = new Map<ItemType, BlockType>();
  private static defaultItem: Item;
  private static initialized = false;

  private static ensureInitialized() {
    if (!this.initialized) {
      this.init();
    }
  }

  public static register(item: Item) {
    const previous = this.items.get(item.id);
    if (previous?.isBlockItem) {
      const previousBlock = previous as BlockItem;
      this.blockToItemMap.delete(previousBlock.blockId);
      this.itemToBlockMap.delete(previousBlock.id);
    }
    this.items.set(item.id, item);
    if (item.isBlockItem) {
      const blockItem = item as BlockItem;
      this.blockToItemMap.set(blockItem.blockId, blockItem.id);
      this.itemToBlockMap.set(blockItem.id, blockItem.blockId);
    }
  }

  public static init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Register Food items (Pure Items)
    this.register(new FoodItem({
      id: ItemType.PORKCHOP,
      name: '生猪肉',
      healAmount: 2,
      hungerAmount: 3,
      textureFaces: { top: 32, bottom: 32, side: 32 },
      color: '#e07890',
      colorHex: 0xe07890,
      droppedModelType: 'cross'
    }));

    this.register(new PlaceableFixtureItem({
      id: ItemType.CHEST,
      name: '箱子',
      fixtureDefinitionId: 'cloudcraft:chest',
      textureFaces: { top: 15, bottom: 15, side: 14 },
      color: '#8b5a2b',
      colorHex: 0x8b5a2b,
    }));

    this.register(new PlaceableFixtureItem({
      id: ItemType.FURNACE,
      name: '火炉',
      fixtureDefinitionId: 'cloudcraft:furnace',
      textureFaces: { top: 3, bottom: 3, side: 3 },
      color: '#606060',
      colorHex: 0x606060,
    }));

    this.register(new PlaceableFixtureItem({
      id: ItemType.FABRICATOR_BENCH,
      name: '构装台',
      fixtureDefinitionId: 'cloudcraft:fabricator_bench',
      textureFaces: { top: 5, bottom: 4, side: 4 },
      color: '#96633a',
      colorHex: 0x96633a,
    }));

    this.register(new FoodItem({
      id: ItemType.APPLE,
      name: '苹果',
      healAmount: 2,
      hungerAmount: 4,
      textureFaces: { top: 33, bottom: 33, side: 33 },
      color: '#ff2222',
      colorHex: 0xff2222,
      droppedModelType: 'cross'
    }));

    this.register(new FoodItem({
      id: ItemType.SEED,
      name: '种子',
      healAmount: 0,
      hungerAmount: 0.5,
      textureFaces: { top: 52, bottom: 52, side: 52 },
      color: '#dbb874',
      colorHex: 0xdbb874,
      droppedModelType: 'cross'
    }));

    // 2. Register BlockItems for all block types automatically
    const blockTypeToKey = new Map<number, string>();
    for (const [key, val] of Object.entries(BLOCK_TYPES)) {
      blockTypeToKey.set(val as number, key);
    }

    const allBlocks = BlockRegistry.getAllBlocks();
    for (const block of allBlocks) {
      if (block.id === BLOCK_TYPES.AIR) continue;
      if (block.id === BLOCK_TYPES.CHEST) continue;

      const keyName = blockTypeToKey.get(block.id);
      if (!keyName) continue;

      // Filter out Top blocks of double-height plants, as they are represented by Sunflower/Rosebush etc. items
      if (keyName.endsWith('_TOP')) {
        continue;
      }

      let itemType: ItemType | undefined = (ItemType as Record<string, string>)[keyName] as ItemType;

      // If not found directly, try stripping _BOTTOM suffix
      if (!itemType && keyName.endsWith('_BOTTOM')) {
        const baseName = keyName.replace('_BOTTOM', '');
        itemType = (ItemType as Record<string, string>)[baseName] as ItemType;
      }

      if (itemType) {
        const props = block.properties;
        const tags: string[] = [];
        if (WOOD_BLOCK_TYPES.has(block.id)) {
          tags.push('cloudcraft:wood');
        }
        if (STONE_BLOCK_TYPES.has(block.id)) {
          tags.push('cloudcraft:stone');
        }
        this.register(new BlockItem({
          id: itemType,
          name: props.name,
          blockId: block.id,
          textureFaces: props.textureFaces,
          droppedModelType: props.model instanceof CrossBlockModel ? 'cross' : 'block',
          color: props.color,
          colorHex: props.colorHex,
          tags,
        }));
      }
    }

    // Legacy voxel chests must still drop the new fixture item during save migration.
    this.blockToItemMap.set(BLOCK_TYPES.CHEST, ItemType.CHEST);

    // Set default item to GRASS
    this.defaultItem = this.get(ItemType.GRASS);

    if (!this.defaultItem) {
      throw new Error(
        '[ItemRegistry] 初始化失败：默认物品 GRASS 未能注册。' +
        '请检查 BlockRegistry 是否在 ItemRegistry 之前完成初始化（模块加载顺序问题）。'
      );
    }
  }

  public static get(id: ItemType): Item {
    // 确保已按需初始化，规避循环依赖导致的未初始化状态
    this.ensureInitialized();
    return this.items.get(id) || this.defaultItem;
  }

  public static getItemTypeFromBlockType(blockType: BlockType): ItemType | null {
    this.ensureInitialized();
    if (blockType === BLOCK_TYPES.AIR) return null;
    return this.blockToItemMap.get(blockType) ?? null;
  }

  public static getBlockTypeFromItemType(itemType: ItemType): BlockType {
    this.ensureInitialized();
    return this.itemToBlockMap.get(itemType) ?? BLOCK_TYPES.AIR;
  }

  public static getAllItems(): Item[] {
    this.ensureInitialized();
    return Array.from(this.items.values());
  }

  public static hasTag(itemType: ItemType, tag: string): boolean {
    return this.get(itemType).hasTag(tag);
  }

  /** 按分类获取所有物品 */
  public static getByCategory(category: ItemCategory): Item[] {
    this.ensureInitialized();
    return Array.from(this.items.values()).filter(i => i.category === category);
  }

  /** 获取所有可放置方块物品 */
  public static getPlaceableItems(): BlockItem[] {
    this.ensureInitialized();
    return this.getByCategory('block') as BlockItem[];
  }

  /** 获取所有食物物品 */
  public static getFoodItems(): FoodItem[] {
    this.ensureInitialized();
    return this.getByCategory('food') as FoodItem[];
  }

  public static getFixtureItems(): PlaceableFixtureItem[] {
    return this.getByCategory('fixture') as PlaceableFixtureItem[];
  }
}
