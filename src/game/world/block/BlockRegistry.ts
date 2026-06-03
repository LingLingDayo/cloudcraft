import { Block } from './Block';
import { BLOCK_TYPES, setPropertiesResolver } from '../BlockConfig';
import {
  AirBlock,
  SimpleSolidBlock,
  SandBlock,
  ChestBlock,
  LeverBlock
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
      hardness: 0.6, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'grass'
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.DIRT, name: '泥土', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 0.5, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'grass'
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.STONE, name: '石头', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 1.5, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone'
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.WOOD, name: '原木', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 2.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'wood'
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.LEAF, name: '树叶', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0.2, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.5, soundType: 'grass'
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.BRICK, name: '红砖', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 2.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone'
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.GLASS, name: '玻璃', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 0.3, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.3, soundType: 'glass', showBreakCracks: false
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.WATER, name: '水', isSolid: false, isTransparent: true, isLiquid: true,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.8, soundType: 'water', showBreakCracks: false
    }));

    this.register(new SandBlock());

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.COAL, name: '煤矿石', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 3.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone'
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.IRON, name: '铁矿石', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 3.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone'
    }));

    this.register(new SimpleSolidBlock({
      id: BLOCK_TYPES.DIAMOND, name: '钻石矿石', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 3.0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 1.0, soundType: 'stone'
    }));

    this.register(new ChestBlock());
    this.register(new LeverBlock());
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

