/* eslint-disable @typescript-eslint/no-explicit-any */
import { BlockEntity, ChestBlockEntity, LeverBlockEntity } from './BlockEntity';

export type BlockEntityCreator = (x: number, y: number, z: number) => BlockEntity;

export class BlockEntityManager {
  private static registry = new Map<string, BlockEntityCreator>();
  private entities = new Map<string, BlockEntity>();

  public static register(type: string, creator: BlockEntityCreator) {
    this.registry.set(type, creator);
  }

  public getEntity(x: number, y: number, z: number): BlockEntity | null {
    return this.entities.get(`${x},${y},${z}`) || null;
  }

  public createEntity(type: string, x: number, y: number, z: number): BlockEntity | null {
    const creator = BlockEntityManager.registry.get(type);
    if (!creator) return null;
    const entity = creator(x, y, z);
    this.entities.set(entity.key, entity);
    return entity;
  }

  public addEntityDirectly(entity: BlockEntity) {
    this.entities.set(entity.key, entity);
  }

  public removeEntity(x: number, y: number, z: number): void {
    this.entities.delete(`${x},${y},${z}`);
  }

  public clear(): void {
    this.entities.clear();
  }

  public serialize(): string {
    const list = Array.from(this.entities.values()).map(e => e.toJSON());
    return JSON.stringify(list);
  }

  public deserialize(jsonStr: string): void {
    this.clear();
    if (!jsonStr) return;
    try {
      const list = JSON.parse(jsonStr) as Record<string, any>[];
      for (const item of list) {
        const entity = this.createEntity(item.type, item.x, item.y, item.z);
        if (entity) {
          entity.fromJSON(item);
        }
      }
    } catch (e) {
      console.error('Failed to load BlockEntities', e);
    }
  }
}

// 注册默认的方块实体
BlockEntityManager.register('chest', (x, y, z) => new ChestBlockEntity(x, y, z));
BlockEntityManager.register('lever', (x, y, z) => new LeverBlockEntity(x, y, z));
