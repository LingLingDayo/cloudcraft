import * as THREE from 'three';
import { ItemType, BlockType, BLOCK_TYPES, GameMode, SoundType } from '@type';
import type { World } from '../world/World';
import { getBlockProperties } from '../world/BlockConfig';

// ─── 物品分类 ───────────────────────────────────────────────

/** 物品分类，用于 UI 筛选、注册表查询等 */
export type ItemCategory = 'block' | 'food' | 'tool' | 'material' | 'misc';

// ─── 交互上下文 (依赖注入，避免 Item 直接引用 GameManager) ───

/** 物品直接使用上下文（右键空气 / 无目标方块时） */
export interface ItemUseContext {
  player: { life: number; hunger: number };
  gameMode: GameMode;
}

/** 物品对方块使用上下文（右键瞄准方块时） */
export interface BlockPlaceContext {
  world: World;
  targetPos: THREE.Vector3;
  placePos: THREE.Vector3;
  face: THREE.Vector3;
  playerBox: THREE.Box3;
  gameMode: GameMode;
}

/** 物品使用后产生的副作用描述，由调用方统一应用 */
export interface ItemUseResult {
  consumed: boolean;
  hungerDelta?: number;
  healDelta?: number;
}

// ─── 物品基础属性 ────────────────────────────────────────────

export interface ItemProperties {
  id: ItemType;
  name: string;
  category?: ItemCategory;
  maxStackSize?: number;
  textureFaces?: { top: number; bottom: number; side: number };
  droppedModelType?: 'block' | 'cross';
  color?: string;
  colorHex?: number;
}

// ─── Item 基类 ──────────────────────────────────────────────

export abstract class Item {
  public readonly id: ItemType;
  public readonly name: string;
  public readonly category: ItemCategory;
  public readonly maxStackSize: number;
  public readonly textureFaces?: { top: number; bottom: number; side: number };
  public readonly droppedModelType: 'block' | 'cross';
  public readonly color?: string;
  public readonly colorHex?: number;

  constructor(properties: ItemProperties) {
    this.id = properties.id;
    this.name = properties.name;
    this.category = properties.category ?? 'misc';
    this.maxStackSize = properties.maxStackSize ?? 100;
    this.textureFaces = properties.textureFaces;
    this.droppedModelType = properties.droppedModelType ?? 'cross';
    this.color = properties.color;
    this.colorHex = properties.colorHex;
  }

  /** 该物品是否可以放置为方块 */
  public get isPlaceable(): boolean {
    return false;
  }

  /** 向后兼容：是否为方块物品 */
  public get isBlockItem(): boolean {
    return false;
  }

  /**
   * 右键空气 / 无目标方块时使用（如食用食物、饮用药水）
   * 返回 null 表示无法使用
   */
  public onUse(_ctx: ItemUseContext): ItemUseResult | null {
    return null;
  }

  /**
   * 右键对准方块时使用（如放置方块、种植种子）
   * 返回 true 表示操作已处理
   */
  public onUseOnBlock(_ctx: BlockPlaceContext): boolean {
    return false;
  }
}

// ─── BlockItem 子类 ─────────────────────────────────────────

export class BlockItem extends Item {
  public readonly blockId: BlockType;

  constructor(properties: ItemProperties & { blockId: BlockType }) {
    super({
      ...properties,
      category: 'block',
      droppedModelType: properties.droppedModelType ?? 'block',
    });
    this.blockId = properties.blockId;
  }

  public override get isPlaceable(): boolean {
    return true;
  }

  public override get isBlockItem(): boolean {
    return true;
  }

  /** 右键对准方块 → 放置方块 */
  public override onUseOnBlock(ctx: BlockPlaceContext): boolean {
    if (this.blockId === BLOCK_TYPES.AIR) return false;

    // 碰撞检查：不能放在玩家身体内
    const blockBox = new THREE.Box3(
      ctx.placePos.clone(),
      new THREE.Vector3(ctx.placePos.x + 1, ctx.placePos.y + 1, ctx.placePos.z + 1),
    );
    if (ctx.playerBox.intersectsBox(blockBox)) return false;

    // 原木朝向处理
    let blockToPlace: number = this.blockId;
    const isLog =
      blockToPlace === BLOCK_TYPES.WOOD ||
      blockToPlace === BLOCK_TYPES.BIRCH_WOOD ||
      blockToPlace === BLOCK_TYPES.SPRUCE_WOOD;
    if (isLog) {
      if (ctx.face.x !== 0) blockToPlace = blockToPlace | (1 << 6); // X axis
      else if (ctx.face.z !== 0) blockToPlace = blockToPlace | (2 << 6); // Z axis
    }

    ctx.world.setBlock(ctx.placePos.x, ctx.placePos.y, ctx.placePos.z, blockToPlace);
    return true;
  }

  /** 获取放置后方块的音效类型 */
  public getPlaceSoundType(): SoundType {
    return getBlockProperties(this.blockId).soundType;
  }
}

// ─── FoodItem 子类 ──────────────────────────────────────────

export class FoodItem extends Item {
  public readonly healAmount: number;
  public readonly hungerAmount: number;

  constructor(properties: ItemProperties & { healAmount: number; hungerAmount: number }) {
    super({
      ...properties,
      category: 'food',
    });
    this.healAmount = properties.healAmount;
    this.hungerAmount = properties.hungerAmount;
  }

  /** 右键使用 → 食用，返回恢复量描述 */
  public override onUse(ctx: ItemUseContext): ItemUseResult | null {
    if (ctx.player.hunger >= 20) return null;
    return {
      consumed: true,
      hungerDelta: this.hungerAmount,
      healDelta: this.healAmount,
    };
  }
}
