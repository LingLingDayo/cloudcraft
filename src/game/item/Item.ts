import { ItemType, BlockType } from '@type';
import type { World } from '../world/World';

export interface ItemProperties {
  id: ItemType;
  name: string;
  maxStackSize?: number;
  textureFaces?: { top: number; bottom: number; side: number };
  droppedModelType?: 'block' | 'cross';
  color?: string;
  colorHex?: number;
}

/** 物品使用后产生的副作用，由调用方统一应用 */
export interface ItemUseEffect {
  hungerDelta?: number;
  healDelta?: number;
}

export abstract class Item {
  public readonly id: ItemType;
  public readonly name: string;
  public readonly maxStackSize: number;
  public readonly textureFaces?: { top: number; bottom: number; side: number };
  public readonly droppedModelType: 'block' | 'cross';
  public readonly color?: string;
  public readonly colorHex?: number;

  constructor(properties: ItemProperties) {
    this.id = properties.id;
    this.name = properties.name;
    this.maxStackSize = properties.maxStackSize ?? 64;
    this.textureFaces = properties.textureFaces;
    this.droppedModelType = properties.droppedModelType ?? 'cross';
    this.color = properties.color;
    this.colorHex = properties.colorHex;
  }

  public get isBlockItem(): boolean {
    return false;
  }

  public canUse(_player: unknown): boolean {
    return false;
  }

  public onUse(_player: unknown): ItemUseEffect | null {
    return null;
  }

  public useOnBlock(
    _world: World,
    _pos: { x: number; y: number; z: number },
    _face: { x: number; y: number; z: number },
    _player: unknown
  ): boolean {
    return false;
  }
}

export class BlockItem extends Item {
  public readonly blockId: BlockType;

  constructor(properties: ItemProperties & { blockId: BlockType }) {
    super({
      ...properties,
      droppedModelType: properties.droppedModelType ?? 'block',
    });
    this.blockId = properties.blockId;
  }

  public override get isBlockItem(): boolean {
    return true;
  }
}

/** 最小 duck-typing 接口，用于检查玩家属性 */
interface PlayerLike {
  hunger: number;
  life: number;
}

export class FoodItem extends Item {
  public readonly healAmount: number;
  public readonly hungerAmount: number;

  constructor(properties: ItemProperties & { healAmount: number; hungerAmount: number }) {
    super(properties);
    this.healAmount = properties.healAmount;
    this.hungerAmount = properties.hungerAmount;
  }

  public override canUse(player: unknown): boolean {
    return (player as PlayerLike).hunger < 20;
  }

  /** 不直接修改 player，返回副作用描述对象由调用方统一应用 */
  public override onUse(player: unknown): ItemUseEffect | null {
    if (!this.canUse(player)) return null;
    return {
      hungerDelta: this.hungerAmount,
      healDelta: this.healAmount,
    };
  }
}
