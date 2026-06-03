/* eslint-disable @typescript-eslint/no-explicit-any */
import { BlockEntity, ChestBlockEntity, LeverBlockEntity } from './BlockEntity';

export class BlockEntityManager {
  private entities = new Map<string, BlockEntity>();

  public getEntity(x: number, y: number, z: number): BlockEntity | null {
    return this.entities.get(`${x},${y},${z}`) || null;
  }

  public createEntity(type: string, x: number, y: number, z: number): BlockEntity | null {
    let entity: BlockEntity;
    switch (type) {
      case 'chest':
        entity = new ChestBlockEntity(x, y, z);
        break;
      case 'lever':
        entity = new LeverBlockEntity(x, y, z);
        break;
      default:
        return null;
    }
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
