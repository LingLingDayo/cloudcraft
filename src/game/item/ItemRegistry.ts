import { Item, BlockItem, FoodItem } from './Item';
import { ItemType, BlockType, BLOCK_TYPES } from '@type';
import { BLOCK_PROPERTIES } from '@game/world/BlockConfig';

export class ItemRegistry {
  private static items = new Map<ItemType, Item>();
  private static blockToItemMap = new Map<BlockType, ItemType>();
  private static itemToBlockMap = new Map<ItemType, BlockType>();
  private static defaultItem: Item;

  public static register(item: Item) {
    this.items.set(item.id, item);
    if (item instanceof BlockItem) {
      this.blockToItemMap.set(item.blockId, item.id);
      this.itemToBlockMap.set(item.id, item.blockId);
    }
  }

  public static init() {
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

    // 2. Register BlockItems for all block types automatically
    const blocksList = [
      { id: BLOCK_TYPES.GRASS, itemId: ItemType.GRASS },
      { id: BLOCK_TYPES.DIRT, itemId: ItemType.DIRT },
      { id: BLOCK_TYPES.STONE, itemId: ItemType.STONE },
      { id: BLOCK_TYPES.WOOD, itemId: ItemType.WOOD },
      { id: BLOCK_TYPES.LEAF, itemId: ItemType.LEAF },
      { id: BLOCK_TYPES.BRICK, itemId: ItemType.BRICK },
      { id: BLOCK_TYPES.GLASS, itemId: ItemType.GLASS },
      { id: BLOCK_TYPES.WATER, itemId: ItemType.WATER },
      { id: BLOCK_TYPES.SAND, itemId: ItemType.SAND },
      { id: BLOCK_TYPES.COAL, itemId: ItemType.COAL },
      { id: BLOCK_TYPES.IRON, itemId: ItemType.IRON },
      { id: BLOCK_TYPES.DIAMOND, itemId: ItemType.DIAMOND },
      { id: BLOCK_TYPES.CHEST, itemId: ItemType.CHEST },
      { id: BLOCK_TYPES.LEVER, itemId: ItemType.LEVER },
      { id: BLOCK_TYPES.BIRCH_WOOD, itemId: ItemType.BIRCH_WOOD },
      { id: BLOCK_TYPES.BIRCH_LEAVES, itemId: ItemType.BIRCH_LEAVES },
      { id: BLOCK_TYPES.SPRUCE_WOOD, itemId: ItemType.SPRUCE_WOOD },
      { id: BLOCK_TYPES.SPRUCE_LEAVES, itemId: ItemType.SPRUCE_LEAVES },
      { id: BLOCK_TYPES.CACTUS, itemId: ItemType.CACTUS },
      { id: BLOCK_TYPES.JUNGLE_WOOD, itemId: ItemType.JUNGLE_WOOD },
      { id: BLOCK_TYPES.JUNGLE_LEAVES, itemId: ItemType.JUNGLE_LEAVES },
      { id: BLOCK_TYPES.SANDSTONE, itemId: ItemType.SANDSTONE },
      { id: BLOCK_TYPES.OAK_SAPLING, itemId: ItemType.OAK_SAPLING },
      { id: BLOCK_TYPES.BIRCH_SAPLING, itemId: ItemType.BIRCH_SAPLING },
      { id: BLOCK_TYPES.SPRUCE_SAPLING, itemId: ItemType.SPRUCE_SAPLING },
      { id: BLOCK_TYPES.JUNGLE_SAPLING, itemId: ItemType.JUNGLE_SAPLING },
      { id: BLOCK_TYPES.DANDELION, itemId: ItemType.DANDELION },
      { id: BLOCK_TYPES.POPPY, itemId: ItemType.POPPY },
      { id: BLOCK_TYPES.BLUE_ORCHID, itemId: ItemType.BLUE_ORCHID },
      { id: BLOCK_TYPES.ALLIUM, itemId: ItemType.ALLIUM },
      { id: BLOCK_TYPES.OXEYE_DAISY, itemId: ItemType.OXEYE_DAISY },
      { id: BLOCK_TYPES.TALL_GRASS, itemId: ItemType.TALL_GRASS },
      { id: BLOCK_TYPES.FERN, itemId: ItemType.FERN },
      { id: BLOCK_TYPES.DEAD_BUSH, itemId: ItemType.DEAD_BUSH },
      { id: BLOCK_TYPES.SUNFLOWER_BOTTOM, itemId: ItemType.SUNFLOWER },
      { id: BLOCK_TYPES.ROSE_BUSH_BOTTOM, itemId: ItemType.ROSE_BUSH },
      { id: BLOCK_TYPES.PEONY_BOTTOM, itemId: ItemType.PEONY },
      { id: BLOCK_TYPES.LILAC_BOTTOM, itemId: ItemType.LILAC },
      { id: BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM, itemId: ItemType.DOUBLE_TALL_GRASS },
    ];

    for (const b of blocksList) {
      const props = BLOCK_PROPERTIES[b.id];
      if (props) {
        this.register(new BlockItem({
          id: b.itemId,
          name: props.name,
          blockId: b.id,
          textureFaces: props.textureFaces,
          droppedModelType: props.isCrossModel ? 'cross' : 'block',
          color: props.color,
          colorHex: props.colorHex
        }));
      }
    }

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
    return this.items.get(id) || this.defaultItem;
  }

  public static getItemTypeFromBlockType(blockType: BlockType): ItemType | null {
    if (blockType === BLOCK_TYPES.AIR) return null;
    return this.blockToItemMap.get(blockType) ?? null;
  }

  public static getBlockTypeFromItemType(itemType: ItemType): BlockType {
    return this.itemToBlockMap.get(itemType) ?? BLOCK_TYPES.AIR;
  }

  public static getAllItems(): Item[] {
    return Array.from(this.items.values());
  }
}

// Automatically initialize the ItemRegistry
ItemRegistry.init();
