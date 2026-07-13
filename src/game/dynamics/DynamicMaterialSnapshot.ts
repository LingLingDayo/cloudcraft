export interface FallingVoxelSnapshotBody {
  readonly blockId: number;
  readonly x: number;
  readonly z: number;
  readonly positionY: number;
  readonly velocityY: number;
  readonly source: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

export interface DynamicMaterialSnapshot {
  readonly schemaVersion: 1;
  readonly bodies: readonly FallingVoxelSnapshotBody[];
}

export const EMPTY_DYNAMIC_MATERIAL_SNAPSHOT: DynamicMaterialSnapshot = Object.freeze({
  schemaVersion: 1,
  bodies: Object.freeze([]),
});

export function assertDynamicMaterialSnapshot(
  value: unknown,
): asserts value is DynamicMaterialSnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Dynamic material snapshot must be an object');
  }
  const snapshot = value as Partial<DynamicMaterialSnapshot>;
  if (snapshot.schemaVersion !== 1) {
    throw new Error(
      `Unsupported dynamic material snapshot schema version: ${String(snapshot.schemaVersion)}`,
    );
  }
  if (!Array.isArray(snapshot.bodies)) {
    throw new Error('Dynamic material snapshot bodies must be an array');
  }

  const sourceKeys = new Set<string>();
  for (const valueBody of snapshot.bodies) {
    if (!valueBody || typeof valueBody !== 'object') {
      throw new Error('Dynamic material snapshot contains an invalid body');
    }
    const body = valueBody as Partial<FallingVoxelSnapshotBody>;
    if (
      !Number.isInteger(body.blockId)
      || !Number.isInteger(body.x)
      || !Number.isInteger(body.z)
      || !Number.isFinite(body.positionY)
      || !Number.isFinite(body.velocityY)
      || body.velocityY! > 0
      || !body.source
      || typeof body.source !== 'object'
      || !Number.isInteger(body.source.x)
      || !Number.isInteger(body.source.y)
      || !Number.isInteger(body.source.z)
      || body.source.x !== body.x
      || body.source.z !== body.z
    ) {
      throw new Error('Dynamic material snapshot contains invalid body data');
    }
    const sourceKey = `${body.source.x},${body.source.y},${body.source.z}`;
    if (sourceKeys.has(sourceKey)) {
      throw new Error(`Dynamic material snapshot contains duplicate source: ${sourceKey}`);
    }
    sourceKeys.add(sourceKey);
  }
}
