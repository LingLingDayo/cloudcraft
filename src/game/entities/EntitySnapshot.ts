import type {
  EntityExtensionData,
  EntitySnapshotValue,
  SerializedEntityData,
} from './Entity';

export interface EntitySnapshot {
  readonly schemaVersion: 1;
  readonly entities: readonly SerializedEntityData[];
}

const ENTITY_NUMERIC_FIELDS = [
  'x',
  'y',
  'z',
  'vx',
  'vy',
  'vz',
  'life',
  'maxLife',
] as const satisfies readonly (keyof SerializedEntityData)[];

const MAX_EXTENSION_DEPTH = 64;

function assertSnapshotValue(
  value: unknown,
  activeObjects: WeakSet<object>,
  depth: number,
): asserts value is EntitySnapshotValue {
  if (depth > MAX_EXTENSION_DEPTH) {
    throw new Error('Entity snapshot extension data exceeds the maximum depth');
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Entity snapshot extension data contains a non-finite number');
    }
    return;
  }
  if (typeof value !== 'object') {
    throw new Error('Entity snapshot extension data contains an unsupported value');
  }
  if (activeObjects.has(value)) {
    throw new Error('Entity snapshot extension data contains a cycle');
  }

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('Entity snapshot extension data must use plain objects');
  }

  activeObjects.add(value);
  const children = Array.isArray(value) ? value : Object.values(value);
  for (const child of children) {
    assertSnapshotValue(child, activeObjects, depth + 1);
  }
  activeObjects.delete(value);
}

function assertSerializedEntityData(value: unknown): asserts value is SerializedEntityData {
  if (!value || typeof value !== 'object') {
    throw new Error('Entity snapshot contains an invalid entity entry');
  }
  const entity = value as Partial<SerializedEntityData>;
  if (typeof entity.id !== 'string' || entity.id.length === 0) {
    throw new Error('Entity snapshot contains an invalid entity id');
  }
  if (typeof entity.type !== 'string' || entity.type.length === 0) {
    throw new Error(`Entity snapshot contains an invalid entity type at ${entity.id}`);
  }
  if (ENTITY_NUMERIC_FIELDS.some(field => !Number.isFinite(entity[field]))) {
    throw new Error(`Entity snapshot contains invalid numeric data at ${entity.id}`);
  }
  if (entity.maxLife! <= 0 || entity.life! < 0 || entity.life! > entity.maxLife!) {
    throw new Error(`Entity snapshot contains invalid life data at ${entity.id}`);
  }
  if (typeof entity.isPersistent !== 'boolean') {
    throw new Error(`Entity snapshot contains invalid persistence data at ${entity.id}`);
  }
  if (entity.customData !== undefined) {
    if (
      !entity.customData
      || typeof entity.customData !== 'object'
      || Array.isArray(entity.customData)
    ) {
      throw new Error(`Entity snapshot contains invalid extension data at ${entity.id}`);
    }
    assertSnapshotValue(entity.customData, new WeakSet(), 0);
  }
}

function cloneSnapshotValue(value: EntitySnapshotValue): EntitySnapshotValue {
  if (Array.isArray(value)) return value.map(cloneSnapshotValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneSnapshotValue(child)]),
    );
  }
  return value;
}

function cloneExtensionData(data: EntityExtensionData): EntityExtensionData {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, cloneSnapshotValue(value)]),
  );
}

export function createEntitySnapshot(
  entities: readonly SerializedEntityData[],
): EntitySnapshot {
  for (const entity of entities) assertSerializedEntityData(entity);
  return {
    schemaVersion: 1,
    entities: entities.map(entity => ({
      ...entity,
      customData: entity.customData ? cloneExtensionData(entity.customData) : undefined,
    })),
  };
}

export function assertEntitySnapshot(snapshot: EntitySnapshot): void {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Entity snapshot must be an object');
  }
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Unsupported entity snapshot schema version: ${snapshot.schemaVersion}`);
  }
  if (!Array.isArray(snapshot.entities)) {
    throw new Error('Entity snapshot entities must be an array');
  }
  const entityIds = new Set<string>();
  for (const entity of snapshot.entities) {
    assertSerializedEntityData(entity);
    if (entityIds.has(entity.id)) {
      throw new Error(`Entity snapshot contains duplicate id: ${entity.id}`);
    }
    entityIds.add(entity.id);
  }
}
