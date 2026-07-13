import * as THREE from 'three';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useGameStore } from '@store/useGameStore';
import type { PlacedFixture } from '@game/fixtures/FixtureTypes';
import {
  FixtureInteractionCoordinator,
  type FixtureInteractionRuntime,
} from './FixtureInteractionCoordinator';

function createFixture(components: PlacedFixture['components']): PlacedFixture {
  return {
    id: 'fixture-test',
    definitionId: 'cloudcraft:test',
    anchor: { x: 1, y: 2, z: 3 },
    orientation: 0,
    components,
  };
}

function createCoordinator(fixture: PlacedFixture) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  object.position.set(1.5, 2.5, -2.5);
  object.updateMatrixWorld();

  const fixtures = {
    get: vi.fn(() => fixture),
    remove: vi.fn(() => true),
    place: vi.fn(() => ({ ok: true as const, fixtureId: 'placed-fixture' })),
  };
  const runtime: FixtureInteractionRuntime = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(75, 1, 0.1, 100),
    physics: { raycast: vi.fn(() => null) },
    fixtureView: {
      raycast: vi.fn(() => ({
        fixtureId: fixture.id,
        distance: 2,
        point: object.position.clone(),
        object,
      })),
    },
    fixtures,
  };
  const coordinator = new FixtureInteractionCoordinator(runtime);
  coordinator.updateTarget(5.2);
  return { coordinator, fixtures };
}

describe('FixtureInteractionCoordinator', () => {
  beforeEach(() => {
    useGameStore.setState({
      activeFixtureId: null,
      craftingCapabilities: [],
      activeChest: null,
      chestInventory: [],
      isInventoryOpen: false,
    });
  });

  test('opens a targeted container through the fixture store context', () => {
    const { coordinator } = createCoordinator(createFixture([{
      type: 'container',
      slots: [{ type: 'apple', count: 2 }],
    }]));

    expect(coordinator.handleInteraction()).toBe(true);
    expect(coordinator.targetedFixtureId).toBe('fixture-test');
    expect(coordinator.selectionBox.visible).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      activeFixtureId: 'fixture-test',
      activeChest: { x: 1, y: 2, z: 3 },
      chestInventory: [{ type: 'apple', count: 2 }],
    });
  });

  test('does not consume interaction for a fixture without interactive components', () => {
    const { coordinator } = createCoordinator(createFixture([{
      type: 'fuel',
      slots: [],
    }]));

    expect(coordinator.handleInteraction()).toBe(false);
    expect(useGameStore.getState().activeFixtureId).toBeNull();
  });
});
