import { CraftingCapability } from '@game/fabrication/CoreRecipes';
import { FixtureRegistry } from './FixtureRegistry';
import type { FixtureDefinition } from './FixtureTypes';

const CORE_FIXTURES: readonly FixtureDefinition[] = [
  {
    id: 'cloudcraft:chest',
    displayName: '箱子',
    footprint: [{ x: 0, y: 0, z: 0 }],
    components: [{ type: 'container', slots: 27 }],
    view: { color: 0x8b5a2b, width: 0.9, height: 0.86, depth: 0.9, model: 'chest' },
  },
  {
    id: 'cloudcraft:furnace',
    displayName: '火炉',
    footprint: [{ x: 0, y: 0, z: 0 }],
    components: [
      { type: 'container', slots: 3 },
      { type: 'fuel', slots: 1 },
      { type: 'processor', capabilities: [CraftingCapability.HEAT] },
    ],
    view: { color: 0x606060, width: 0.92, height: 0.92, depth: 0.92 },
  },
  {
    id: 'cloudcraft:fabricator_bench',
    displayName: '构装台',
    footprint: [{ x: 0, y: 0, z: 0 }],
    components: [
      { type: 'container', slots: 9 },
      {
        type: 'crafting',
        capabilities: [
          CraftingCapability.HAND_ASSEMBLY,
          CraftingCapability.SHAPE,
          CraftingCapability.BIND,
          CraftingCapability.STABILIZE,
        ],
      },
    ],
    view: { color: 0x96633a, width: 0.96, height: 0.8, depth: 0.96 },
  },
];

export function createCoreFixtureRegistry(): FixtureRegistry {
  const registry = new FixtureRegistry();
  for (const definition of CORE_FIXTURES) {
    registry.register(definition);
  }
  registry.freeze();
  return registry;
}
