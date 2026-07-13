export interface SnapshotEnvelope<TPayload> {
  readonly contextId: string;
  readonly schemaVersion: number;
  readonly codecId: string;
  readonly revision: number;
  readonly payload: TPayload;
}

export interface SnapshotCodec<TPayload, TEncoded = unknown> {
  readonly id: string;
  encode(payload: TPayload): TEncoded;
  decode(encoded: TEncoded): TPayload;
}

export interface SnapshotMigrator<TPayload> {
  readonly contextId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(payload: unknown): TPayload;
}

export function createSnapshotEnvelope<TPayload>(
  envelope: SnapshotEnvelope<TPayload>,
): SnapshotEnvelope<TPayload> {
  if (!envelope.contextId) {
    throw new Error('Snapshot contextId is required');
  }
  if (!Number.isInteger(envelope.schemaVersion) || envelope.schemaVersion < 1) {
    throw new Error(`Invalid snapshot schema version: ${envelope.schemaVersion}`);
  }
  if (!envelope.codecId) {
    throw new Error('Snapshot codecId is required');
  }
  if (!Number.isInteger(envelope.revision) || envelope.revision < 0) {
    throw new Error(`Invalid snapshot revision: ${envelope.revision}`);
  }
  return Object.freeze({ ...envelope });
}

export function assertSnapshotCompatibility(
  snapshot: SnapshotEnvelope<unknown>,
  expectedContextId: string,
  supportedSchemaVersion: number,
): void {
  if (snapshot.contextId !== expectedContextId) {
    throw new Error(
      `Snapshot context mismatch: expected ${expectedContextId}, received ${snapshot.contextId}`,
    );
  }
  if (snapshot.schemaVersion > supportedSchemaVersion) {
    throw new Error(
      `Unsupported ${expectedContextId} snapshot schema version: ${snapshot.schemaVersion}`,
    );
  }
}
