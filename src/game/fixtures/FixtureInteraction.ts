import type {
  FixtureComponentState,
  FixtureCoordinate,
  PlacedFixture,
} from './FixtureTypes';

export type FixtureInteractionDescription =
  | {
    readonly kind: 'container';
    readonly fixtureId: string;
    readonly anchor: FixtureCoordinate;
    readonly slots: Extract<FixtureComponentState, { type: 'container' }>;
  }
  | {
    readonly kind: 'workbench';
    readonly fixtureId: string;
    readonly capabilities: readonly string[];
  }
  | {
    readonly kind: 'none';
    readonly fixtureId: string;
  };

export function describeFixtureInteraction(
  fixture: PlacedFixture,
): FixtureInteractionDescription {
  const capabilities = new Set<string>();
  let container: Extract<FixtureComponentState, { type: 'container' }> | undefined;

  for (const component of fixture.components) {
    if (component.type === 'crafting' || component.type === 'processor') {
      for (const capability of component.capabilities) {
        capabilities.add(capability);
      }
    } else if (component.type === 'container' && !container) {
      container = component;
    }
  }

  if (capabilities.size > 0) {
    return {
      kind: 'workbench',
      fixtureId: fixture.id,
      capabilities: Array.from(capabilities),
    };
  }

  if (container) {
    return {
      kind: 'container',
      fixtureId: fixture.id,
      anchor: { ...fixture.anchor },
      slots: container,
    };
  }

  return { kind: 'none', fixtureId: fixture.id };
}
