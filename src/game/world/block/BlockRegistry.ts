import { Block } from './Block';
import { BLOCK_TYPES, setPropertiesResolver, type BlockType } from '../BlockConfig';
import type { BlockProperties } from '../BlockConfig';
import {
  AirBlock,
  SimpleSolidBlock,
  SandBlock,
  ChestBlock,
  LeverBlock,
  LeafBlock,
  SaplingBlock,
  FlowerBlock,
  DoublePlantBottomBlock,
  DoublePlantTopBlock
} from './BlockClasses';

/** 花朵/植被通用属性工厂 */
function flowerProps(id: BlockType, name: string, texture: number, opts?: Partial<BlockProperties>): BlockProperties {
  return {
    id, name, isSolid: true, isTransparent: true, isLiquid: false,
    hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
    droppedModelType: 'cross', isCollidable: false, isCrossModel: true,
    crossScaleW: 0.6, crossScaleH: 0.65, enableCrossOffset: true, canSpawnOn: false,
    textureFaces: { top: texture, bottom: texture, side: texture },
    ...opts,
  };
}

/** 双层植物通用属性工厂 */
function doublePlantProps(id: BlockType, name: string, translationKey: string, texture: number, opts?: Partial<BlockProperties>): BlockProperties {
  return {
    id, name, translationKey, isSolid: true, isTransparent: true, isLiquid: false,
    hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
    droppedModelType: 'cross', isCollidable: false, isCrossModel: true,
    crossScaleW: 0.85, crossScaleH: 1.0, enableCrossOffset: true, canSpawnOn: false,
    textureFaces: { top: texture, bottom: texture, side: texture },
    ...opts,
  };
}

export class BlockRegistry {
  private static blocks = new Map<number, Block>();
  private static defaultBlock: Block;

  public static register(block: Block) {
    this.blocks.set(block.id, block);
  }

  public static init() {
    this.defaultBlock = new AirBlock();
    this.register(this.defaultBlock);

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.GRASS, name: '草方块', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 0.6, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'grass',
      color: '#56a032', colorHex: 0x56a032, allowVegetationBase: true,
      textureFaces: { top: 0, bottom: 2, side: 1 }
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.DIRT, name: '泥土', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 0.5, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'grass',
      color: '#825a3c', colorHex: 0x825a3c, allowVegetationBase: true,
      textureFaces: { top: 2, bottom: 2, side: 2 }
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.STONE, name: '石头', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 1.5, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone',
      color: '#787878', colorHex: 0x787878, allowVegetationBase: true,
      textureFaces: { top: 3, bottom: 3, side: 3 }
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.WOOD, name: '原木', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 2.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'wood',
      color: '#78552d', colorHex: 0x78552d,
      textureFaces: { top: 5, bottom: 5, side: 4 }
    }));

    this.register(new LeafBlock({
      id: BLOCK_TYPES.LEAF, name: '树叶', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0.2, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#2d7823', colorHex: 0x2d7823,
      textureFaces: { top: 6, bottom: 6, side: 6 },
      renderAdjacentSameType: true, renderInternalCross: true,
      lootTable: [
        { itemType: 'oak_sapling', probability: 0.1 },
        { itemType: 'apple', probability: 0.05 }
      ]
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.BIRCH_WOOD, name: '桦木', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 2.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'wood',
      color: '#dcdcdc', colorHex: 0xdcdcdc,
      textureFaces: { top: 17, bottom: 17, side: 16 }
    }));

    this.register(new LeafBlock({
      id: BLOCK_TYPES.BIRCH_LEAVES, name: '桦树叶', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0.2, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#8fc04e', colorHex: 0x8fc04e,
      textureFaces: { top: 18, bottom: 18, side: 18 },
      renderAdjacentSameType: true, renderInternalCross: true,
      lootTable: [
        { itemType: 'birch_sapling', probability: 0.1 }
      ]
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.SPRUCE_WOOD, name: '松木', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 2.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'wood',
      color: '#5c4033', colorHex: 0x5c4033,
      textureFaces: { top: 20, bottom: 20, side: 19 }
    }));

    this.register(new LeafBlock({
      id: BLOCK_TYPES.SPRUCE_LEAVES, name: '松树叶', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0.2, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#2d5a27', colorHex: 0x2d5a27,
      textureFaces: { top: 21, bottom: 21, side: 21 },
      renderAdjacentSameType: true, renderInternalCross: true,
      lootTable: [
        { itemType: 'spruce_sapling', probability: 0.1 }
      ]
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.BRICK, name: '红砖', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 2.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone',
      color: '#b85c38', colorHex: 0xa03c2d,
      textureFaces: { top: 7, bottom: 7, side: 7 }
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.GLASS, name: '玻璃', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0.3, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.3, soundType: 'glass', showBreakCracks: false,
      color: 'rgba(150, 230, 255, 0.35)', colorHex: 0xe0f7fa, border: '1.5px solid #96e6ff',
      textureFaces: { top: 8, bottom: 8, side: 8 }
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.WATER, name: '水', isSolid: false, isTransparent: true, isLiquid: true,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.8, soundType: 'water', showBreakCracks: false,
      color: 'rgba(40, 110, 220, 0.75)', colorHex: 0x286edc,
      textureFaces: { top: 9, bottom: 9, side: 9 }
    }));

    this.register(new SandBlock());

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.COAL, name: '煤矿石', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 3.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone',
      color: '#2c2c2c', colorHex: 0x282828,
      textureFaces: { top: 11, bottom: 11, side: 11 }
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.IRON, name: '铁矿石', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 3.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone',
      color: '#d0b090', colorHex: 0xbe825a,
      textureFaces: { top: 12, bottom: 12, side: 12 }
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.DIAMOND, name: '钻石矿石', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 3.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone',
      color: '#5cdcfa', colorHex: 0x5cdcfa, border: '1.5px solid #2db4d2',
      textureFaces: { top: 13, bottom: 13, side: 13 }
    }));

    this.register(new ChestBlock());
    this.register(new LeverBlock());

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.CACTUS, name: '仙人掌', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0.4, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'grass',
      color: '#2d7823', colorHex: 0x2d7823,
      textureFaces: { top: 23, bottom: 23, side: 22 }
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.JUNGLE_WOOD, name: '丛林木', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 2.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'wood',
      color: '#5c4033', colorHex: 0x5c4033,
      textureFaces: { top: 25, bottom: 25, side: 24 }
    }));

    this.register(new LeafBlock({
      id: BLOCK_TYPES.JUNGLE_LEAVES, name: '丛林叶', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0.2, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#1a5f12', colorHex: 0x1a5f12,
      textureFaces: { top: 26, bottom: 26, side: 26 },
      renderAdjacentSameType: true, renderInternalCross: true,
      lootTable: [
        { itemType: 'jungle_sapling', probability: 0.1 }
      ]
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.SANDSTONE, name: '砂岩', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 0.8, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone',
      color: '#d2b48c', colorHex: 0xd2b48c,
      textureFaces: { top: 27, bottom: 27, side: 27 }
    }));

    this.register(new SaplingBlock({
      id: BLOCK_TYPES.OAK_SAPLING, name: '橡树树苗', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#4c9436', colorHex: 0x4c9436,
      textureFaces: { top: 28, bottom: 28, side: 28 },
      droppedModelType: 'cross', isCollidable: false, isCrossModel: true, crossScaleW: 0.6, crossScaleH: 0.7, enableCrossOffset: true
    }));

    this.register(new SaplingBlock({
      id: BLOCK_TYPES.BIRCH_SAPLING, name: '桦树树苗', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#8fc04e', colorHex: 0x8fc04e,
      textureFaces: { top: 29, bottom: 29, side: 29 },
      droppedModelType: 'cross', isCollidable: false, isCrossModel: true, crossScaleW: 0.6, crossScaleH: 0.7, enableCrossOffset: true
    }));

    this.register(new SaplingBlock({
      id: BLOCK_TYPES.SPRUCE_SAPLING, name: '松树树苗', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#2d5a27', colorHex: 0x2d5a27,
      textureFaces: { top: 30, bottom: 30, side: 30 },
      droppedModelType: 'cross', isCollidable: false, isCrossModel: true, crossScaleW: 0.6, crossScaleH: 0.7, enableCrossOffset: true
    }));

    this.register(new SaplingBlock({
      id: BLOCK_TYPES.JUNGLE_SAPLING, name: '丛林树苗', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#1a5f12', colorHex: 0x1a5f12,
      textureFaces: { top: 31, bottom: 31, side: 31 },
      droppedModelType: 'cross', isCollidable: false, isCrossModel: true, crossScaleW: 0.6, crossScaleH: 0.7, enableCrossOffset: true
    }));

    // ─── Flowers (使用 flowerProps 工厂) ────────────────────
    this.register(new FlowerBlock(flowerProps(BLOCK_TYPES.DANDELION, '蒲公英', 34, { color: '#ffeb3b', colorHex: 0xffeb3b })));
    this.register(new FlowerBlock(flowerProps(BLOCK_TYPES.POPPY, '玫瑰', 35, { color: '#f44336', colorHex: 0xf44336 })));
    this.register(new FlowerBlock(flowerProps(BLOCK_TYPES.BLUE_ORCHID, '兰花', 36, { color: '#2196f3', colorHex: 0x2196f3 })));
    this.register(new FlowerBlock(flowerProps(BLOCK_TYPES.ALLIUM, '绒球葱', 37, { color: '#e040fb', colorHex: 0xe040fb })));
    this.register(new FlowerBlock(flowerProps(BLOCK_TYPES.OXEYE_DAISY, '雏菊', 38, { color: '#eeeeee', colorHex: 0xeeeeee })));
    this.register(new FlowerBlock(flowerProps(BLOCK_TYPES.TALL_GRASS, '草丛', 39, { color: '#4caf50', colorHex: 0x4caf50, crossScaleW: 0.85, crossScaleH: 0.85, lootTable: [{ itemType: 'seed', probability: 0.1 }] })));
    this.register(new FlowerBlock(flowerProps(BLOCK_TYPES.FERN, '蕨', 40, { color: '#388e3c', colorHex: 0x388e3c, crossScaleW: 0.85, crossScaleH: 0.85 })));
    this.register(new FlowerBlock(flowerProps(BLOCK_TYPES.DEAD_BUSH, '枯萎的灌木', 41, { color: '#a08060', colorHex: 0xa08060, crossScaleW: 0.75, crossScaleH: 0.75 })));

    // ─── Double height plants (使用 doublePlantProps 工厂) ──
    this.register(new DoublePlantBottomBlock(doublePlantProps(BLOCK_TYPES.SUNFLOWER_BOTTOM, '向日葵(底)', 'sunflower', 42, { color: '#4caf50', colorHex: 0x4caf50 }), BLOCK_TYPES.SUNFLOWER_TOP));
    this.register(new DoublePlantTopBlock(doublePlantProps(BLOCK_TYPES.SUNFLOWER_TOP, '向日葵(顶)', 'sunflower', 43, { color: '#ffeb3b', colorHex: 0xffeb3b, lootTable: [{ itemType: 'sunflower', probability: 1.0 }] }), BLOCK_TYPES.SUNFLOWER_BOTTOM));

    this.register(new DoublePlantBottomBlock(doublePlantProps(BLOCK_TYPES.ROSE_BUSH_BOTTOM, '玫瑰丛(底)', 'rose_bush', 44, { color: '#4caf50', colorHex: 0x4caf50 }), BLOCK_TYPES.ROSE_BUSH_TOP));
    this.register(new DoublePlantTopBlock(doublePlantProps(BLOCK_TYPES.ROSE_BUSH_TOP, '玫瑰丛(顶)', 'rose_bush', 45, { color: '#f44336', colorHex: 0xf44336, lootTable: [{ itemType: 'rose_bush', probability: 1.0 }] }), BLOCK_TYPES.ROSE_BUSH_BOTTOM));

    this.register(new DoublePlantBottomBlock(doublePlantProps(BLOCK_TYPES.PEONY_BOTTOM, '牡丹(底)', 'peony', 46, { color: '#4caf50', colorHex: 0x4caf50 }), BLOCK_TYPES.PEONY_TOP));
    this.register(new DoublePlantTopBlock(doublePlantProps(BLOCK_TYPES.PEONY_TOP, '牡丹(顶)', 'peony', 47, { color: '#f8bbd0', colorHex: 0xf8bbd0, lootTable: [{ itemType: 'peony', probability: 1.0 }] }), BLOCK_TYPES.PEONY_BOTTOM));

    this.register(new DoublePlantBottomBlock(doublePlantProps(BLOCK_TYPES.LILAC_BOTTOM, '丁香(底)', 'lilac', 48, { color: '#4caf50', colorHex: 0x4caf50 }), BLOCK_TYPES.LILAC_TOP));
    this.register(new DoublePlantTopBlock(doublePlantProps(BLOCK_TYPES.LILAC_TOP, '丁香(顶)', 'lilac', 49, { color: '#d1c4e9', colorHex: 0xd1c4e9, lootTable: [{ itemType: 'lilac', probability: 1.0 }] }), BLOCK_TYPES.LILAC_BOTTOM));

    this.register(new DoublePlantBottomBlock(doublePlantProps(BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM, '双格高草(底)', 'double_tall_grass', 50, { color: '#4caf50', colorHex: 0x4caf50, lootTable: [{ itemType: 'seed', probability: 0.1 }] }), BLOCK_TYPES.DOUBLE_TALL_GRASS_TOP));
    this.register(new DoublePlantTopBlock(doublePlantProps(BLOCK_TYPES.DOUBLE_TALL_GRASS_TOP, '双格高草(顶)', 'double_tall_grass', 51, { color: '#81c784', colorHex: 0x81c784, lootTable: [{ itemType: 'seed', probability: 0.1 }] }), BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM));
  }

  public static getAllBlocks(): Block[] {
    return Array.from(this.blocks.values());
  }

  public static get(id: number): Block {
    return this.blocks.get(id) || this.defaultBlock;
  }

  public static getBlockProperties(id: number) {
    return this.get(id).properties;
  }
}

// Ensure the static init is executed
BlockRegistry.init();
setPropertiesResolver((id) => BlockRegistry.getBlockProperties(id));
