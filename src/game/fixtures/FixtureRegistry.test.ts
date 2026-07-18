import { describe, expect, test } from 'vitest';
import { createCoreFixtureRegistry } from './FixtureDefinitions';
import { describeFixtureInteraction } from './FixtureInteraction';
import { FixtureRegistry } from './FixtureRegistry';
import { TEST_CHEST_FIXTURE_DEFINITION as chestDefinition } from './FixtureTestFixtures';

describe('core fixture definitions', () => {
  test.each([
    ['duplicate footprint coordinate', {
      ...chestDefinition,
      id: 'cloudcraft:duplicate_footprint',
      footprint: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
    }],
    ['invalid footprint coordinate', {
      ...chestDefinition,
      id: 'cloudcraft:invalid_footprint',
      footprint: [{ x: Number.NaN, y: 0, z: 0 }],
    }],
    ['duplicate component type', {
      ...chestDefinition,
      id: 'cloudcraft:duplicate_component',
      components: [
        { type: 'container' as const, slots: 2 },
        { type: 'container' as const, slots: 3 },
      ],
    }],
    ['invalid slot capacity', {
      ...chestDefinition,
      id: 'cloudcraft:invalid_slots',
      components: [{ type: 'container' as const, slots: 0 }],
    }],
    ['invalid capability', {
      ...chestDefinition,
      id: 'cloudcraft:invalid_capability',
      components: [{ type: 'crafting' as const, capabilities: [''] }],
    }],
    ['duplicate capability', {
      ...chestDefinition,
      id: 'cloudcraft:duplicate_capability',
      components: [{
        type: 'processor' as const,
        capabilities: ['cloudcraft:heat', 'cloudcraft:heat'],
      }],
    }],
  ])('rejects fixture definitions with %s', (_case, definition) => {
    const registry = new FixtureRegistry();
    expect(() => registry.register(definition)).toThrow(/fixture/i);
    expect(registry.getAll()).toHaveLength(0);
  });

  test('composes chest, furnace and fabricator behavior from reusable components', () => {
    const registry = createCoreFixtureRegistry();

    expect(registry.get('cloudcraft:chest').components.map(component => component.type))
      .toEqual(['container']);
    expect(registry.get('cloudcraft:furnace').components.map(component => component.type))
      .toEqual(['container', 'fuel', 'processor']);
    expect(registry.get('cloudcraft:fabricator_bench').components.map(component => component.type))
      .toEqual(['container', 'crafting']);
  });

  test('declares survival mining hardness and sound types for core fixtures', () => {
    const registry = createCoreFixtureRegistry();

    expect(registry.get('cloudcraft:chest')).toMatchObject({ hardness: 2.5, soundType: 'wood' });
    expect(registry.get('cloudcraft:furnace')).toMatchObject({ hardness: 3.5, soundType: 'stone' });
    expect(registry.get('cloudcraft:fabricator_bench')).toMatchObject({
      hardness: 2.5,
      soundType: 'wood',
    });
  });

  test('describes container and workbench interactions from fixture components', () => {
    const registry = createCoreFixtureRegistry();
    const createFixture = (definitionId: string) => ({
      id: `fixture:${definitionId}`,
      definitionId,
      anchor: { x: 4, y: 5, z: 6 },
      orientation: 0 as const,
      components: registry.get(definitionId).components.map(component => {
        if (component.type === 'container' || component.type === 'fuel') {
          return { type: component.type, slots: Array(component.slots).fill(null) };
        }
        if (component.type === 'processor') {
          return { type: component.type, capabilities: component.capabilities, progress: 0 };
        }
        return { type: component.type, capabilities: component.capabilities };
      }),
    });

    expect(describeFixtureInteraction(createFixture('cloudcraft:chest'))).toMatchObject({
      kind: 'container',
      fixtureId: 'fixture:cloudcraft:chest',
    });
    expect(describeFixtureInteraction(createFixture('cloudcraft:furnace'))).toEqual({
      kind: 'workbench',
      fixtureId: 'fixture:cloudcraft:furnace',
      capabilities: ['cloudcraft:heat'],
    });
    expect(describeFixtureInteraction(createFixture('cloudcraft:fabricator_bench'))).toEqual({
      kind: 'workbench',
      fixtureId: 'fixture:cloudcraft:fabricator_bench',
      capabilities: [
        'cloudcraft:hand_assembly',
        'cloudcraft:shape',
        'cloudcraft:bind',
        'cloudcraft:stabilize',
      ],
    });
  });
});
