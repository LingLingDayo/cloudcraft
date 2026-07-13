import type { FixtureDefinition, FixtureSnapshotEntry } from './FixtureTypes';

export const TEST_CHEST_FIXTURE_DEFINITION: FixtureDefinition = {
  id: 'cloudcraft:chest',
  displayName: '箱子',
  footprint: [{ x: 0, y: 0, z: 0 }],
  components: [{ type: 'container', slots: 27 }],
};

export function createChestSnapshotEntry(
  id: string,
  anchor: { readonly x: number; readonly y: number; readonly z: number },
): FixtureSnapshotEntry {
  return {
    id,
    definitionId: TEST_CHEST_FIXTURE_DEFINITION.id,
    anchor,
    orientation: 0,
    components: [{ type: 'container', slots: Array(27).fill(null) }],
  };
}
