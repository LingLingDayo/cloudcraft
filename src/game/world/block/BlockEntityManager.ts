import {
  assertChestBlockEntitySnapshot,
  assertLeverBlockEntitySnapshot,
  BlockEntity,
  ChestBlockEntity,
  LeverBlockEntity,
} from './BlockEntity';

export type BlockEntityCreator = (x: number, y: number, z: number) => BlockEntity;

export interface BlockEntityDefinition {
  readonly create: BlockEntityCreator;
  readonly validateSnapshot: (data: Record<string, unknown>) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class BlockEntityManager {
  private static registry = new Map<string, BlockEntityDefinition>();
  private entities = new Map<string, BlockEntity>();

  public static register(type: string, definition: BlockEntityDefinition) {
    this.registry.set(type, definition);
  }

  public getEntity(x: number, y: number, z: number): BlockEntity | null {
    return this.entities.get(`${x},${y},${z}`) || null;
  }

  public createEntity(type: string, x: number, y: number, z: number): BlockEntity | null {
    const definition = BlockEntityManager.registry.get(type);
    if (!definition) return null;
    const entity = definition.create(x, y, z);
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

  /** Builds detached entities so malformed snapshots cannot mutate the active world. */
  public prepareSerialized(jsonStr: string): readonly BlockEntity[] {
    if (!jsonStr) return [];
    const value: unknown = JSON.parse(jsonStr);
    if (!Array.isArray(value)) {
      throw new Error('Block entity snapshot must be an array');
    }

    const prepared: BlockEntity[] = [];
    const occupiedCoordinates = new Set<string>();
    for (const item of value) {
      if (
        !isRecord(item)
        || typeof item.type !== 'string'
        || !Number.isInteger(item.x)
        || !Number.isInteger(item.y)
        || !Number.isInteger(item.z)
      ) {
        throw new Error('Block entity snapshot contains invalid identity or coordinates');
      }
      const definition = BlockEntityManager.registry.get(item.type);
      if (!definition) continue;
      definition.validateSnapshot(item);
      const entity = definition.create(Number(item.x), Number(item.y), Number(item.z));
      if (occupiedCoordinates.has(entity.key)) {
        throw new Error(`Block entity snapshot contains duplicate coordinate: ${entity.key}`);
      }
      occupiedCoordinates.add(entity.key);
      entity.fromJSON(item);
      prepared.push(entity);
    }
    return prepared;
  }

  public restorePrepared(entities: readonly BlockEntity[]): void {
    this.entities = new Map(entities.map(entity => [entity.key, entity]));
  }

  public deserialize(jsonStr: string): void {
    this.restorePrepared(this.prepareSerialized(jsonStr));
  }
}

// 注册默认的方块实体
BlockEntityManager.register('chest', {
  create: (x, y, z) => new ChestBlockEntity(x, y, z),
  validateSnapshot: assertChestBlockEntitySnapshot,
});
BlockEntityManager.register('lever', {
  create: (x, y, z) => new LeverBlockEntity(x, y, z),
  validateSnapshot: assertLeverBlockEntitySnapshot,
});
