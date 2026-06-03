/* eslint-disable @typescript-eslint/no-unused-vars */
import type { World } from '../World';
import type { BlockEntity } from './BlockEntity';
import { BlockType, SoundType } from '@type';

export interface BlockProperties {
  id: BlockType;
  name: string;
  isSolid: boolean;
  isTransparent: boolean;
  isLiquid: boolean;
  hardness: number;
  affectedByGravity: boolean;
  lightLevel: number;
  isInteractable: boolean;
  opacity: number;
  soundType: SoundType;
  showBreakCracks?: boolean;
}

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

  /**
   * 玩家右键交互
   * @returns 返回 true 拦截后续的物品放置
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
}

