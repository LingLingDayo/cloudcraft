import { Block } from './Block';
import { BLOCK_TYPES, setPropertiesResolver } from '../BlockConfig';
import {
  AirBlock,
  SimpleSolidBlock,
  SandBlock,
  ChestBlock,
  LeverBlock,
  LeafBlock,
  SaplingBlock,
  PureItem
} from './BlockClasses';

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
      renderAdjacentSameType: true,
      renderInternalCross: true
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
      renderAdjacentSameType: true,
      renderInternalCross: true
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
      renderAdjacentSameType: true,
      renderInternalCross: true
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
      renderAdjacentSameType: true,
      renderInternalCross: true
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
      droppedModelType: 'cross'
    }));

    this.register(new SaplingBlock({
      id: BLOCK_TYPES.BIRCH_SAPLING, name: '桦树树苗', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#8fc04e', colorHex: 0x8fc04e,
      textureFaces: { top: 29, bottom: 29, side: 29 },
      droppedModelType: 'cross'
    }));

    this.register(new SaplingBlock({
      id: BLOCK_TYPES.SPRUCE_SAPLING, name: '松树树苗', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#2d5a27', colorHex: 0x2d5a27,
      textureFaces: { top: 30, bottom: 30, side: 30 },
      droppedModelType: 'cross'
    }));

    this.register(new SaplingBlock({
      id: BLOCK_TYPES.JUNGLE_SAPLING, name: '丛林树苗', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass',
      color: '#1a5f12', colorHex: 0x1a5f12,
      textureFaces: { top: 31, bottom: 31, side: 31 },
      droppedModelType: 'cross'
    }));

    this.register(new PureItem({
      id: BLOCK_TYPES.PORKCHOP, name: '生猪肉', isSolid: false, isTransparent: true, isLiquid: false,
      hardness: -1, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'none',
      color: '#e07890', colorHex: 0xe07890,
      textureFaces: { top: 32, bottom: 32, side: 32 },
      droppedModelType: 'cross'
    }));
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

