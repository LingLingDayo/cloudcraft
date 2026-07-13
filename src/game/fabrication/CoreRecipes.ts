import { ItemType } from '@type';
import { ProcessRecipeRegistry } from './ProcessRecipeRegistry';
import type { ProcessRecipe } from './CraftingTypes';

export const CraftingCapability = {
  HAND_ASSEMBLY: 'cloudcraft:hand_assembly',
  SHAPE: 'cloudcraft:shape',
  BIND: 'cloudcraft:bind',
  STABILIZE: 'cloudcraft:stabilize',
  HEAT: 'cloudcraft:heat',
} as const;

const CORE_RECIPES: readonly ProcessRecipe[] = [
  {
    id: 'cloudcraft:fabricator_bench',
    inputs: [
      { role: 'structure', selector: { tag: 'cloudcraft:wood' }, count: 4 },
      { role: 'binding', selector: { itemType: ItemType.IRON }, count: 2 },
    ],
    steps: [{ capability: CraftingCapability.HAND_ASSEMBLY }],
    outputs: [{ type: ItemType.FABRICATOR_BENCH, count: 1 }],
  },
  {
    id: 'cloudcraft:chest',
    inputs: [{ role: 'structure', selector: { tag: 'cloudcraft:wood' }, count: 8 }],
    steps: [{ capability: CraftingCapability.HAND_ASSEMBLY }],
    outputs: [{ type: ItemType.CHEST, count: 1 }],
  },
  {
    id: 'cloudcraft:furnace',
    inputs: [{ role: 'structure', selector: { itemType: ItemType.STONE }, count: 8 }],
    steps: [{ capability: CraftingCapability.HAND_ASSEMBLY }],
    outputs: [{ type: ItemType.FURNACE, count: 1 }],
  },
  {
    id: 'cloudcraft:sandstone',
    inputs: [{ role: 'material', selector: { itemType: ItemType.SAND }, count: 4 }],
    steps: [{ capability: CraftingCapability.HAND_ASSEMBLY }],
    outputs: [{ type: ItemType.SANDSTONE, count: 1 }],
  },
  {
    id: 'cloudcraft:lever',
    inputs: [
      { role: 'structure', selector: { itemType: ItemType.STONE }, count: 1 },
      { role: 'binding', selector: { itemType: ItemType.IRON }, count: 1 },
    ],
    steps: [
      { capability: CraftingCapability.SHAPE },
      { capability: CraftingCapability.BIND },
    ],
    outputs: [{ type: ItemType.LEVER, count: 1 }],
  },
  {
    id: 'cloudcraft:glass',
    inputs: [{ role: 'material', selector: { itemType: ItemType.SAND }, count: 2 }],
    steps: [{ capability: CraftingCapability.HEAT, durationSeconds: 4 }],
    outputs: [{ type: ItemType.GLASS, count: 1 }],
  },
];

export function createCoreRecipeRegistry(): ProcessRecipeRegistry {
  const registry = new ProcessRecipeRegistry();
  for (const recipe of CORE_RECIPES) {
    registry.register(recipe);
  }
  registry.freeze();
  return registry;
}
