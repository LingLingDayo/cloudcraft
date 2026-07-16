import {
  GameMode,
  type GameMode as GameModeValue,
  type HotbarItem,
  ItemType,
  type ItemType as ItemTypeValue,
  type Vector3D,
} from '@type';
import type { FixtureSnapshot } from '@game/fixtures/FixtureTypes';
import {
  assertEntitySnapshot,
  createEntitySnapshot,
  type EntitySnapshot,
} from '@game/entities/EntitySnapshot';
import type { SerializedEntityData } from '@game/entities/Entity';
import {
  validateWeatherSnapshot,
  type WeatherSnapshot,
} from '@game/environment/WeatherTimeline';
import { SaveManager, type SaveData } from './SaveManager';

const INVENTORY_SLOT_COUNT = 54;
const VALID_ITEM_TYPES = new Set<string>(Object.values(ItemType));
const LEGACY_ENTITY_TYPE_MIGRATIONS: Readonly<Record<string, string>> = Object.freeze({
  pig: 'cloudcraft:pig',
});

interface MutablePosition extends Vector3D {
  set(x: number, y: number, z: number): unknown;
}

export interface GameSaveRuntimePort {
  readonly world: {
    saveWorld(): string;
    getSeed(): string;
    loadWorld(serializedWorld: string): void;
  };
  readonly player: {
    readonly position: MutablePosition;
    syncCamera(): void;
  };
  readonly entities?: {
    createSnapshot(): EntitySnapshot;
    restoreSnapshot(snapshot: EntitySnapshot): void;
  };
  readonly fixtures: {
    createSnapshot(): FixtureSnapshot;
    restoreSnapshot(snapshot: FixtureSnapshot): void;
  };
  readonly environment: {
    createSnapshot(): WeatherSnapshot;
    restoreSnapshot(snapshot: WeatherSnapshot): void;
  };
}

export interface GameSaveStoreSource {
  readonly hotbar: readonly (HotbarItem | null)[];
  readonly inventory: readonly (HotbarItem | null)[];
  readonly activeSlot: number;
  readonly gameMode: GameModeValue;
}

export interface RestoredGameStoreState extends GameSaveStoreSource {
  readonly hotbar: (HotbarItem | null)[];
  readonly inventory: (HotbarItem | null)[];
  readonly selectedItem: ItemTypeValue | null;
}

interface RuntimeRollbackState {
  readonly world: string;
  readonly entities?: EntitySnapshot;
  readonly fixtures: FixtureSnapshot;
  readonly weather: WeatherSnapshot;
  readonly player: Vector3D;
}

function cloneSlots(slots: readonly (HotbarItem | null)[]): (HotbarItem | null)[] {
  return slots.map(item => item ? { ...item } : null);
}

function captureRuntimeRollbackState(runtime: GameSaveRuntimePort): RuntimeRollbackState {
  return {
    world: runtime.world.saveWorld(),
    entities: runtime.entities?.createSnapshot(),
    fixtures: runtime.fixtures.createSnapshot(),
    weather: runtime.environment.createSnapshot(),
    player: {
      x: runtime.player.position.x,
      y: runtime.player.position.y,
      z: runtime.player.position.z,
    },
  };
}

function rollbackRuntimeState(
  runtime: GameSaveRuntimePort,
  rollback: RuntimeRollbackState,
): unknown[] {
  const errors: unknown[] = [];
  const attempt = (operation: () => void): void => {
    try {
      operation();
    } catch (error) {
      errors.push(error);
    }
  };

  attempt(() => runtime.world.loadWorld(rollback.world));
  attempt(() => runtime.fixtures.restoreSnapshot(rollback.fixtures));
  const entitySnapshot = rollback.entities;
  const entityRuntime = runtime.entities;
  if (entitySnapshot && entityRuntime) {
    attempt(() => entityRuntime.restoreSnapshot(entitySnapshot));
  }
  attempt(() => runtime.environment.restoreSnapshot(rollback.weather));
  attempt(() => {
    runtime.player.position.set(rollback.player.x, rollback.player.y, rollback.player.z);
    runtime.player.syncCamera();
  });
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateEntityEntries(
  entities: unknown,
): asserts entities is SerializedEntityData[] {
  if (!Array.isArray(entities)) {
    throw new Error('Entity snapshot entities must be an array');
  }
  for (const entity of entities) {
    if (!isRecord(entity) || typeof entity.id !== 'string' || typeof entity.type !== 'string') {
      throw new Error('Entity snapshot entries must contain string id and type fields');
    }
    const numericFields = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'maxLife'] as const;
    if (numericFields.some(field => !Number.isFinite(entity[field]))) {
      throw new Error('Entity snapshot entries must contain finite numeric state');
    }
    if (typeof entity.isPersistent !== 'boolean') {
      throw new Error('Entity snapshot entries must contain a boolean persistence flag');
    }
  }
}

function migrateEntityCustomData(
  customData: SerializedEntityData['customData'],
): SerializedEntityData['customData'] {
  if (!customData || !isRecord(customData)) return customData;
  const legacyAiState = customData.aiState;
  const hasBehaviorState = typeof customData.behaviorStateId === 'string';
  if (hasBehaviorState || typeof legacyAiState !== 'string') {
    return customData;
  }
  const { aiState: _aiState, ...rest } = customData;
  return {
    ...rest,
    behaviorStateId: legacyAiState,
  };
}

function migrateEntityEntry(entity: SerializedEntityData): SerializedEntityData {
  return {
    ...entity,
    type: LEGACY_ENTITY_TYPE_MIGRATIONS[entity.type] ?? entity.type,
    customData: migrateEntityCustomData(entity.customData),
  };
}

function normalizeEntitySnapshot(
  savedEntities: SaveData['entities'],
): EntitySnapshot | undefined {
  if (savedEntities === undefined) return undefined;
  if (Array.isArray(savedEntities)) {
    validateEntityEntries(savedEntities);
    return createEntitySnapshot(savedEntities.map(migrateEntityEntry));
  }
  if (!isRecord(savedEntities)) {
    throw new Error('Entity snapshot must be an object');
  }
  assertEntitySnapshot(savedEntities);
  validateEntityEntries(savedEntities.entities);
  // Schema 1 快照也可能夹带旧 customData.aiState，统一在持久化边界迁移
  return createEntitySnapshot(savedEntities.entities.map(migrateEntityEntry));
}

function validateFixtureSnapshot(snapshot: FixtureSnapshot): void {
  if (!isRecord(snapshot)) {
    throw new Error('Fixture snapshot must be an object');
  }
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Unsupported fixture snapshot schema version: ${snapshot.schemaVersion}`);
  }
  if (!Array.isArray(snapshot.fixtures)) {
    throw new Error('Fixture snapshot fixtures must be an array');
  }
  for (const fixture of snapshot.fixtures) {
    if (!isRecord(fixture) || typeof fixture.id !== 'string' || typeof fixture.definitionId !== 'string') {
      throw new Error('Fixture snapshot entries must contain string identifiers');
    }
    if (
      !isRecord(fixture.anchor)
      || !Number.isInteger(fixture.anchor.x)
      || !Number.isInteger(fixture.anchor.y)
      || !Number.isInteger(fixture.anchor.z)
    ) {
      throw new Error('Fixture snapshot anchors must contain integer coordinates');
    }
    if (!Number.isInteger(fixture.orientation) || Number(fixture.orientation) < 0 || Number(fixture.orientation) > 3) {
      throw new Error('Fixture snapshot orientations must be quarter turns');
    }
    if (!Array.isArray(fixture.components)) {
      throw new Error('Fixture snapshot components must be an array');
    }
    for (const component of fixture.components) {
      if (!isRecord(component) || typeof component.type !== 'string') {
        throw new Error('Fixture snapshot components must contain a type');
      }
      if (component.type === 'container' || component.type === 'fuel') {
        validateSlots(component.slots, 'fixture slots');
      } else if (component.type === 'crafting') {
        continue;
      } else if (component.type === 'processor') {
        if (!Number.isFinite(component.progress) || Number(component.progress) < 0) {
          throw new Error('Fixture snapshot processor state is invalid');
        }
      } else {
        throw new Error(`Fixture snapshot contains unknown component type: ${component.type}`);
      }
    }
  }
}

function validateSlots(value: unknown, fieldName: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid save data: ${fieldName} must be an array`);
  }
  for (const item of value) {
    if (item === null) continue;
    if (
      typeof item !== 'object'
      || typeof (item as Partial<HotbarItem>).type !== 'string'
      || !VALID_ITEM_TYPES.has((item as Partial<HotbarItem>).type!)
      || !Number.isInteger((item as Partial<HotbarItem>).count)
      || (item as Partial<HotbarItem>).count! <= 0
    ) {
      throw new Error(`Invalid save data: ${fieldName} contains an invalid item stack`);
    }
  }
}

function validateBaseSaveData(save: SaveData): void {
  if (typeof save.world !== 'string' || typeof save.version !== 'string') {
    throw new Error('Invalid save data: world and version must be strings');
  }
  if (
    typeof save.player !== 'object'
    || save.player === null
    || !Number.isFinite(save.player.x)
    || !Number.isFinite(save.player.y)
    || !Number.isFinite(save.player.z)
  ) {
    throw new Error('Invalid save data: player position must contain finite coordinates');
  }

  validateSlots(save.hotbar, 'hotbar');
  if (save.inventory !== undefined) {
    validateSlots(save.inventory, 'inventory');
  }
  if (save.activeSlot !== undefined && (!Number.isInteger(save.activeSlot) || save.activeSlot < 0)) {
    throw new Error('Invalid save data: activeSlot must be a non-negative integer');
  }
  if (save.gameMode !== GameMode.ADVENTURE && save.gameMode !== GameMode.CREATIVE) {
    throw new Error(`Invalid save data: unsupported game mode ${String(save.gameMode)}`);
  }
}

function validateSaveSnapshots(save: SaveData): void {
  if (save.fixtures !== undefined) {
    validateFixtureSnapshot(save.fixtures);
  }
  if (save.weather !== undefined) {
    validateWeatherSnapshot(save.weather);
  }
}

export function captureGameSaveData(
  runtime: GameSaveRuntimePort,
  store: GameSaveStoreSource,
): SaveData {
  return {
    world: runtime.world.saveWorld(),
    seed: runtime.world.getSeed(),
    player: {
      x: runtime.player.position.x,
      y: runtime.player.position.y,
      z: runtime.player.position.z,
    },
    hotbar: cloneSlots(store.hotbar),
    inventory: cloneSlots(store.inventory),
    activeSlot: store.activeSlot,
    gameMode: store.gameMode,
    version: SaveManager.GAME_VERSION,
    entities: runtime.entities?.createSnapshot(),
    fixtures: runtime.fixtures.createSnapshot(),
    weather: runtime.environment.createSnapshot(),
  };
}

export function restoreGameSaveData(
  runtime: GameSaveRuntimePort,
  save: SaveData,
): RestoredGameStoreState {
  validateBaseSaveData(save);
  const entities = normalizeEntitySnapshot(save.entities);
  validateSaveSnapshots(save);
  const rollback = captureRuntimeRollbackState(runtime);

  try {
    if (save.world) {
      runtime.world.loadWorld(save.world);
    }
    if (save.fixtures) {
      runtime.fixtures.restoreSnapshot(save.fixtures);
    }
    if (entities && runtime.entities) {
      runtime.entities.restoreSnapshot(entities);
    }
    if (save.weather) {
      runtime.environment.restoreSnapshot(save.weather);
    }

    runtime.player.position.set(save.player.x, save.player.y, save.player.z);
    runtime.player.syncCamera();
  } catch (error) {
    const rollbackErrors = rollbackRuntimeState(runtime, rollback);
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Game save restoration and rollback both failed',
        { cause: error },
      );
    }
    throw new Error('Game save restoration failed', { cause: error });
  }

  const hotbar = cloneSlots(save.hotbar);
  const inventory = cloneSlots(save.inventory ?? []);
  if (inventory.length < INVENTORY_SLOT_COUNT) {
    inventory.push(...Array<null>(INVENTORY_SLOT_COUNT - inventory.length).fill(null));
  } else if (inventory.length > INVENTORY_SLOT_COUNT) {
    inventory.length = INVENTORY_SLOT_COUNT;
  }

  const activeSlot = Math.max(0, Math.min(save.activeSlot ?? 0, Math.max(0, hotbar.length - 1)));
  return {
    hotbar,
    inventory,
    activeSlot,
    selectedItem: hotbar[activeSlot]?.type ?? null,
    gameMode: save.gameMode,
  };
}
