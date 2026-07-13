import type { SerializedEntityData } from './Entity';

export interface EntitySnapshot {
  readonly schemaVersion: 1;
  readonly entities: readonly SerializedEntityData[];
}

export function createEntitySnapshot(
  entities: readonly SerializedEntityData[],
): EntitySnapshot {
  return {
    schemaVersion: 1,
    entities: entities.map(entity => ({
      ...entity,
      customData: entity.customData ? { ...entity.customData } : undefined,
    })),
  };
}

export function assertEntitySnapshot(snapshot: EntitySnapshot): void {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Unsupported entity snapshot schema version: ${snapshot.schemaVersion}`);
  }
}
