import type {
  FixtureComponentDefinition,
  FixtureComponentSnapshot,
  FixtureComponentState,
  FixtureCoordinate,
  FixtureDefinition,
  FixtureOrientation,
  FixturePlacementResult,
  FixtureSnapshot,
  FixtureViewPort,
  FixtureWorldPort,
  PlacedFixture,
} from './FixtureTypes';
import { ItemType, type ItemStack } from '@type';
import type { FixtureRegistry } from './FixtureRegistry';

type FixtureIdFactory = () => string;

const ITEM_TYPE_IDS = new Set<string>(Object.values(ItemType));

function isFixtureCoordinate(value: unknown): value is FixtureCoordinate {
  if (typeof value !== 'object' || value === null) return false;
  const coordinate = value as Record<string, unknown>;
  return Number.isInteger(coordinate.x)
    && Number.isInteger(coordinate.y)
    && Number.isInteger(coordinate.z);
}

function isFixtureOrientation(value: unknown): value is FixtureOrientation {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
}

function isValidItemStack(value: unknown): value is ItemStack {
  if (typeof value !== 'object' || value === null) return false;
  const stack = value as Record<string, unknown>;
  return typeof stack.type === 'string'
    && ITEM_TYPE_IDS.has(stack.type)
    && Number.isInteger(stack.count)
    && Number(stack.count) > 0;
}

function coordinateKey(coordinate: FixtureCoordinate): string {
  return `${coordinate.x},${coordinate.y},${coordinate.z}`;
}

function rotateOffset(
  offset: FixtureCoordinate,
  orientation: FixtureOrientation,
): FixtureCoordinate {
  switch (orientation) {
    case 1:
      return { x: -offset.z, y: offset.y, z: offset.x };
    case 2:
      return { x: -offset.x, y: offset.y, z: -offset.z };
    case 3:
      return { x: offset.z, y: offset.y, z: -offset.x };
    default:
      return offset;
  }
}

function createComponentState(definition: FixtureComponentDefinition): FixtureComponentState {
  switch (definition.type) {
    case 'container':
      return { type: 'container', slots: Array(definition.slots).fill(null) };
    case 'crafting':
      return { type: 'crafting', capabilities: [...definition.capabilities] };
    case 'fuel':
      return { type: 'fuel', slots: Array(definition.slots).fill(null) };
    case 'processor':
      return { type: 'processor', capabilities: [...definition.capabilities], progress: 0 };
  }
}

function assertFixtureCoordinate(
  coordinate: FixtureCoordinate,
  fixtureId: string,
): void {
  if (!isFixtureCoordinate(coordinate)) {
    throw new Error(`Fixture snapshot contains invalid coordinate at ${fixtureId}`);
  }
}

function assertFixtureOrientation(
  orientation: FixtureOrientation,
  fixtureId: string,
): void {
  if (!isFixtureOrientation(orientation)) {
    throw new Error(`Fixture snapshot contains invalid orientation at ${fixtureId}`);
  }
}

function cloneSnapshotSlots(
  value: unknown,
  expectedSlots: number,
  fixtureId: string,
  componentType: 'container' | 'fuel',
): Array<ItemStack | null> {
  if (!Array.isArray(value) || value.length !== expectedSlots) {
    throw new Error(`Fixture snapshot ${componentType} capacity mismatch at ${fixtureId}`);
  }

  return value.map((stack) => {
    if (stack === null) return null;
    if (!isValidItemStack(stack)) {
      throw new Error(`Fixture snapshot contains invalid item stack at ${fixtureId}`);
    }
    return { ...stack };
  });
}

function restoreComponentStates(
  definition: FixtureDefinition,
  snapshots: readonly FixtureComponentSnapshot[],
  fixtureId: string,
): FixtureComponentState[] {
  if (!Array.isArray(snapshots) || snapshots.length !== definition.components.length) {
    throw new Error(`Fixture snapshot component count mismatch at ${fixtureId}`);
  }

  return definition.components.map((componentDefinition, index) => {
    const snapshot = snapshots[index] as FixtureComponentSnapshot | undefined;
    if (!snapshot || snapshot.type !== componentDefinition.type) {
      throw new Error(`Fixture snapshot component type mismatch at ${fixtureId}`);
    }

    switch (componentDefinition.type) {
      case 'container':
        return {
          type: 'container',
          slots: cloneSnapshotSlots(
            'slots' in snapshot ? snapshot.slots : undefined,
            componentDefinition.slots,
            fixtureId,
            'container',
          ),
        };
      case 'crafting':
        return {
          type: 'crafting',
          capabilities: [...componentDefinition.capabilities],
        };
      case 'fuel':
        return {
          type: 'fuel',
          slots: cloneSnapshotSlots(
            'slots' in snapshot ? snapshot.slots : undefined,
            componentDefinition.slots,
            fixtureId,
            'fuel',
          ),
        };
      case 'processor': {
        const progress = 'progress' in snapshot ? snapshot.progress : undefined;
        if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0) {
          throw new Error(`Fixture snapshot contains invalid processor progress at ${fixtureId}`);
        }
        return {
          type: 'processor',
          capabilities: [...componentDefinition.capabilities],
          progress,
        };
      }
    }
  });
}

function defaultIdFactory(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `fixture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class WorldFixtureManager {
  private readonly registry: FixtureRegistry;
  private readonly world: FixtureWorldPort;
  private readonly view?: FixtureViewPort;
  private readonly createId: FixtureIdFactory;
  private readonly fixtures = new Map<string, PlacedFixture>();
  private readonly occupancy = new Map<string, string>();

  public constructor(
    registry: FixtureRegistry,
    world: FixtureWorldPort,
    view?: FixtureViewPort,
    createId: FixtureIdFactory = defaultIdFactory,
  ) {
    this.registry = registry;
    this.world = world;
    this.view = view;
    this.createId = createId;
  }

  public place(
    definitionId: string,
    anchor: FixtureCoordinate,
    orientation: FixtureOrientation,
  ): FixturePlacementResult {
    const definition = this.registry.find(definitionId);
    if (!definition) return { ok: false, reason: 'unknown_definition' };
    if (!isFixtureCoordinate(anchor) || !isFixtureOrientation(orientation)) {
      return { ok: false, reason: 'invalid_placement' };
    }

    const occupiedCells = definition.footprint.map(offset => {
      const rotated = rotateOffset(offset, orientation);
      return {
        x: anchor.x + rotated.x,
        y: anchor.y + rotated.y,
        z: anchor.z + rotated.z,
      };
    });

    if (occupiedCells.some(cell => this.occupancy.has(coordinateKey(cell)))) {
      return { ok: false, reason: 'occupied' };
    }
    if (occupiedCells.some(cell => !this.world.canOccupy(cell))) {
      return { ok: false, reason: 'blocked' };
    }

    const fixtureId = this.createId();
    if (!fixtureId || this.fixtures.has(fixtureId)) {
      throw new Error(`Duplicate fixture id: ${fixtureId}`);
    }

    const fixture: PlacedFixture = {
      id: fixtureId,
      definitionId,
      anchor: { ...anchor },
      orientation,
      components: definition.components.map(createComponentState),
    };

    this.fixtures.set(fixture.id, fixture);
    for (const cell of occupiedCells) {
      this.occupancy.set(coordinateKey(cell), fixture.id);
    }
    try {
      this.view?.attach(fixture, definition);
    } catch (attachError) {
      this.fixtures.delete(fixture.id);
      for (const cell of occupiedCells) {
        this.occupancy.delete(coordinateKey(cell));
      }
      try {
        this.view?.detach(fixture.id);
      } catch (detachError) {
        throw new AggregateError(
          [attachError, detachError],
          `Failed to attach and clean up fixture view: ${fixture.id}`,
          { cause: detachError },
        );
      }
      throw attachError;
    }
    return { ok: true, fixtureId: fixture.id };
  }

  public get(id: string): PlacedFixture | undefined {
    return this.fixtures.get(id);
  }

  public getDefinition(definitionId: string): FixtureDefinition | undefined {
    return this.registry.find(definitionId);
  }

  public getAt(coordinate: FixtureCoordinate): PlacedFixture | undefined {
    const fixtureId = this.occupancy.get(coordinateKey(coordinate));
    return fixtureId ? this.fixtures.get(fixtureId) : undefined;
  }

  public setContainerSlots(
    fixtureId: string,
    slots: readonly (ItemStack | null)[],
  ): boolean {
    const fixture = this.fixtures.get(fixtureId);
    const container = fixture?.components.find(component => component.type === 'container');
    const definition = fixture ? this.registry.find(fixture.definitionId) : undefined;
    const containerDefinition = definition?.components
      .find(component => component.type === 'container');
    if (
      !container ||
      container.type !== 'container' ||
      !containerDefinition ||
      containerDefinition.type !== 'container' ||
      slots.length !== containerDefinition.slots ||
      slots.some(stack => stack !== null && !isValidItemStack(stack))
    ) {
      return false;
    }
    container.slots = slots.map(stack => stack ? { ...stack } : null);
    return true;
  }

  public remove(id: string): boolean {
    const fixture = this.fixtures.get(id);
    if (!fixture) return false;
    const definition = this.registry.get(fixture.definitionId);
    for (const offset of definition.footprint) {
      const rotated = rotateOffset(offset, fixture.orientation);
      this.occupancy.delete(coordinateKey({
        x: fixture.anchor.x + rotated.x,
        y: fixture.anchor.y + rotated.y,
        z: fixture.anchor.z + rotated.z,
      }));
    }
    this.fixtures.delete(id);
    this.view?.detach(id);
    return true;
  }

  public createSnapshot(): FixtureSnapshot {
    return {
      schemaVersion: 1,
      fixtures: Array.from(this.fixtures.values()).map(fixture => ({
        ...fixture,
        anchor: { ...fixture.anchor },
        components: fixture.components.map(component => {
          if (component.type === 'container' || component.type === 'fuel') {
            return {
              type: component.type,
              slots: component.slots.map(stack => stack ? { ...stack } : null),
            };
          }
          if (component.type === 'processor') {
            return { type: 'processor', progress: component.progress };
          }
          return { type: 'crafting' };
        }),
      })),
    };
  }

  public restoreSnapshot(snapshot: FixtureSnapshot): void {
    if (!snapshot || typeof snapshot !== 'object' || snapshot.schemaVersion !== 1) {
      throw new Error(
        `Unsupported fixture snapshot schema version: ${String(snapshot?.schemaVersion)}`,
      );
    }
    if (!Array.isArray(snapshot.fixtures)) {
      throw new Error('Fixture snapshot fixtures must be an array');
    }

    const restoredFixtures = new Map<string, PlacedFixture>();
    const restoredOccupancy = new Map<string, string>();

    for (const savedFixture of snapshot.fixtures) {
      if (
        !savedFixture ||
        typeof savedFixture !== 'object' ||
        typeof savedFixture.id !== 'string' ||
        savedFixture.id.length === 0 ||
        typeof savedFixture.definitionId !== 'string' ||
        savedFixture.definitionId.length === 0 ||
        !savedFixture.anchor ||
        typeof savedFixture.anchor !== 'object'
      ) {
        throw new Error('Fixture snapshot contains an invalid fixture entry');
      }
      const definition = this.registry.find(savedFixture.definitionId);
      if (!definition) {
        throw new Error(`Unknown fixture definition in snapshot: ${savedFixture.definitionId}`);
      }
      if (restoredFixtures.has(savedFixture.id)) {
        throw new Error(`Fixture snapshot contains duplicate id: ${savedFixture.id}`);
      }
      assertFixtureCoordinate(savedFixture.anchor, savedFixture.id);
      assertFixtureOrientation(savedFixture.orientation, savedFixture.id);

      const occupiedCells = definition.footprint.map(offset => {
        const rotated = rotateOffset(offset, savedFixture.orientation);
        return {
          x: savedFixture.anchor.x + rotated.x,
          y: savedFixture.anchor.y + rotated.y,
          z: savedFixture.anchor.z + rotated.z,
        };
      });
      if (occupiedCells.some(cell => restoredOccupancy.has(coordinateKey(cell)))) {
        throw new Error(`Fixture snapshot contains overlapping occupancy at ${savedFixture.id}`);
      }
      if (occupiedCells.some(cell => !this.world.canOccupy(cell))) {
        throw new Error(`Fixture snapshot is blocked at ${savedFixture.id}`);
      }

      const fixture: PlacedFixture = {
        id: savedFixture.id,
        definitionId: savedFixture.definitionId,
        anchor: { ...savedFixture.anchor },
        orientation: savedFixture.orientation,
        components: restoreComponentStates(
          definition,
          savedFixture.components,
          savedFixture.id,
        ),
      };

      restoredFixtures.set(fixture.id, fixture);
      for (const cell of occupiedCells) {
        restoredOccupancy.set(coordinateKey(cell), fixture.id);
      }
    }

    const previousFixtures = new Map(this.fixtures);
    const previousOccupancy = new Map(this.occupancy);

    try {
      for (const fixtureId of previousFixtures.keys()) {
        this.view?.detach(fixtureId);
      }

      this.fixtures.clear();
      this.occupancy.clear();
      for (const [fixtureId, fixture] of restoredFixtures) {
        this.fixtures.set(fixtureId, fixture);
      }
      for (const [key, fixtureId] of restoredOccupancy) {
        this.occupancy.set(key, fixtureId);
      }

      for (const fixture of restoredFixtures.values()) {
        const definition = this.registry.get(fixture.definitionId);
        this.view?.attach(fixture, definition);
      }
    } catch (restoreError) {
      this.fixtures.clear();
      this.occupancy.clear();
      for (const [fixtureId, fixture] of previousFixtures) {
        this.fixtures.set(fixtureId, fixture);
      }
      for (const [key, fixtureId] of previousOccupancy) {
        this.occupancy.set(key, fixtureId);
      }

      const rollbackErrors: unknown[] = [];
      for (const fixtureId of restoredFixtures.keys()) {
        try {
          this.view?.detach(fixtureId);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      for (const fixture of previousFixtures.values()) {
        try {
          const definition = this.registry.get(fixture.definitionId);
          this.view?.attach(fixture, definition);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }

      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [restoreError, ...rollbackErrors],
          'Failed to restore fixture snapshot and roll back its view state',
          { cause: restoreError },
        );
      }
      throw new Error('Failed to restore fixture snapshot view state', {
        cause: restoreError,
      });
    }
  }

  public dispose(): void {
    for (const fixtureId of Array.from(this.fixtures.keys())) {
      this.remove(fixtureId);
    }
    this.view?.dispose();
  }
}
