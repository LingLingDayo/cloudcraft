 
import type { World } from '../World';
import type { BlockEntity } from './BlockEntity';
import { BlockType, SoundType, ItemType } from '@type';
import type { BlockProperties } from '../BlockConfig';
import { ItemRegistry } from '../../item/ItemRegistry';
import type { LootContext } from '../../loot/LootTable';
import { LootTableRegistry } from '../../loot/LootTableRegistry';
import * as THREE from 'three';
export type { BlockProperties };


export abstract class Block {
  public readonly properties: BlockProperties;

  constructor(properties: BlockProperties) {
    this.properties = properties;
  }

  public get id(): BlockType { return this.properties.id; }
  public get name(): string { return this.properties.name; }
  public get isSolid(): boolean { return this.properties.isSolid; }
  public get isTransparent(): boolean { return this.properties.isTransparent; }
  public get isLiquid(): boolean { return this.properties.isLiquid; }
  public get hardness(): number { return this.properties.hardness; }
  public get affectedByGravity(): boolean { return this.properties.affectedByGravity; }
  public get lightLevel(): number { return this.properties.lightLevel; }
  public get isInteractable(): boolean { return this.properties.isInteractable; }
  public get opacity(): number { return this.properties.opacity; }
  public get soundType(): SoundType { return this.properties.soundType; }
  public get showBreakCracks(): boolean { return this.properties.showBreakCracks !== false; }
  public get allowVegetationBase(): boolean { return this.properties.allowVegetationBase === true; }

  /**
   * 玩家右键交互
   * @returns 返回 true 拦截后续 of 物品放置
   */
  public onInteract(_world: World, _x: number, _y: number, _z: number, _player: unknown): boolean {
    return false;
  }

  /**
   * 方块被放置
   */
  public onPlaced(_world: World, _x: number, _y: number, _z: number): void {}

  /**
   * 方块被破坏
   */
  public onDestroyed(_world: World, _x: number, _y: number, _z: number): void {}

  /**
   * 邻居方块发生变化
   */
  public onNeighborChanged(
    _world: World,
    _x: number, _y: number, _z: number,
    _neighborX: number, _neighborY: number, _neighborZ: number
  ): void {}

  /**
   * 该方块是否需要关联的 BlockEntity
   */
  public hasBlockEntity(): boolean {
    return false;
  }

  /**
   * 创建该方块的 BlockEntity 实例
   */
  public createBlockEntity(_x: number, _y: number, _z: number): BlockEntity | null {
    return null;
  }

  /**
   * 获取该方块破坏后的掉落物
   */
  public getDrops(context?: LootContext): { type: ItemType; count: number }[] {
    if (this.properties.lootTableId) {
      const table = LootTableRegistry.get(this.properties.lootTableId);
      if (table) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = context || { world: {} as any, position: new THREE.Vector3() };
        return table.generateLoot(ctx);
      }
    }

    if (this.properties.lootTable && this.properties.lootTable.length > 0) {
      const drops: { type: ItemType; count: number }[] = [];
      for (const entry of this.properties.lootTable) {
        if (Math.random() < entry.probability) {
          const min = entry.minCount ?? 1;
          const max = entry.maxCount ?? 1;
          const count = min === max ? min : min + Math.floor(Math.random() * (max - min + 1));
          if (count > 0) {
            drops.push({ type: entry.itemType as ItemType, count });
          }
        }
      }
      return drops;
    }

    const itemType = ItemRegistry.getItemTypeFromBlockType(this.id);
    return itemType ? [{ type: itemType, count: 1 }] : [];
  }
}


