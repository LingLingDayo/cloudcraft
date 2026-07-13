import { describe, expect, test } from 'vitest';
import { ItemType, type ItemStack } from '@type';
import { CraftingService } from './CraftingService';
import { ProcessRecipeRegistry } from './ProcessRecipeRegistry';
import type { CraftingItemCatalog, InventoryState, ProcessRecipe } from './CraftingTypes';
import { createCoreRecipeRegistry } from './CoreRecipes';
import { coreCraftingService, HAND_CRAFTING_CAPABILITIES } from './CraftingRuntime';

const WOOD_ITEM_TYPES = new Set<ItemType>([
  ItemType.WOOD,
  ItemType.BIRCH_WOOD,
  ItemType.SPRUCE_WOOD,
  ItemType.JUNGLE_WOOD,
]);

const catalog: CraftingItemCatalog = {
  hasTag: (itemType, tag) => {
    if (tag === 'cloudcraft:wood') return WOOD_ITEM_TYPES.has(itemType);
    if (tag === 'cloudcraft:oak') return itemType === ItemType.WOOD;
    return false;
  },
  getMaxStackSize: () => 100,
};

const createInventory = (
  hotbar: Array<ItemStack | null>,
  inventory: Array<ItemStack | null>,
): InventoryState => ({ hotbar, inventory });

describe('CraftingService', () => {
  test('matches ingredient tags across inventory zones and commits output atomically', () => {
    const recipe: ProcessRecipe = {
      id: 'cloudcraft:test_chest',
      inputs: [{ role: 'structure', selector: { tag: 'cloudcraft:wood' }, count: 4 }],
      steps: [{ capability: 'cloudcraft:hand_assembly' }],
      outputs: [{ type: ItemType.CHEST, count: 1 }],
    };
    const recipes = new ProcessRecipeRegistry();
    recipes.register(recipe);
    const service = new CraftingService(recipes, catalog);
    const before = createInventory(
      [{ type: ItemType.WOOD, count: 2 }, null],
      [{ type: ItemType.BIRCH_WOOD, count: 3 }, null],
    );

    const result = service.craft(
      recipe.id,
      before,
      new Set(['cloudcraft:hand_assembly']),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected crafting to succeed');
    expect(result.inventory.hotbar).toEqual([{ type: ItemType.CHEST, count: 1 }, null]);
    expect(result.inventory.inventory).toEqual([
      { type: ItemType.BIRCH_WOOD, count: 1 },
      null,
    ]);
    expect(before.hotbar[0]).toEqual({ type: ItemType.WOOD, count: 2 });
  });

  test('reserves exact item requirements before consuming overlapping tags', () => {
    const recipe: ProcessRecipe = {
      id: 'cloudcraft:test_overlap',
      inputs: [
        { role: 'structure', selector: { tag: 'cloudcraft:wood' }, count: 1 },
        { role: 'binding', selector: { itemType: ItemType.WOOD }, count: 1 },
      ],
      steps: [{ capability: 'cloudcraft:hand_assembly' }],
      outputs: [{ type: ItemType.CHEST, count: 1 }],
    };
    const recipes = new ProcessRecipeRegistry();
    recipes.register(recipe);
    const service = new CraftingService(recipes, catalog);
    const before = createInventory([
      { type: ItemType.WOOD, count: 1 },
      { type: ItemType.BIRCH_WOOD, count: 1 },
      null,
    ], []);

    const result = service.craft(
      recipe.id,
      before,
      new Set(['cloudcraft:hand_assembly']),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected overlapping ingredients to be allocated');
    expect(result.inventory.hotbar).toEqual([
      { type: ItemType.CHEST, count: 1 },
      null,
      null,
    ]);
    expect(before.hotbar).toEqual([
      { type: ItemType.WOOD, count: 1 },
      { type: ItemType.BIRCH_WOOD, count: 1 },
      null,
    ]);
  });

  test('finds a complete allocation for overlapping tag requirements', () => {
    const recipe: ProcessRecipe = {
      id: 'cloudcraft:test_overlapping_tags',
      inputs: [
        { role: 'structure', selector: { tag: 'cloudcraft:wood' }, count: 1 },
        { role: 'binding', selector: { tag: 'cloudcraft:oak' }, count: 1 },
      ],
      steps: [{ capability: 'cloudcraft:hand_assembly' }],
      outputs: [{ type: ItemType.CHEST, count: 1 }],
    };
    const recipes = new ProcessRecipeRegistry();
    recipes.register(recipe);
    const service = new CraftingService(recipes, catalog);
    const before = createInventory([
      { type: ItemType.WOOD, count: 1 },
      { type: ItemType.BIRCH_WOOD, count: 1 },
      null,
    ], []);

    const result = service.craft(
      recipe.id,
      before,
      new Set(['cloudcraft:hand_assembly']),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected overlapping tags to be allocated');
    expect(result.inventory.hotbar).toEqual([
      { type: ItemType.CHEST, count: 1 },
      null,
      null,
    ]);
  });

  test('rejects recipes whose process capability is unavailable without mutating inventory', () => {
    const recipe: ProcessRecipe = {
      id: 'cloudcraft:test_glass',
      inputs: [{ role: 'material', selector: { itemType: ItemType.SAND }, count: 1 }],
      steps: [{ capability: 'cloudcraft:heat' }],
      outputs: [{ type: ItemType.GLASS, count: 1 }],
    };
    const recipes = new ProcessRecipeRegistry();
    recipes.register(recipe);
    const service = new CraftingService(recipes, catalog);
    const before = createInventory([{ type: ItemType.SAND, count: 1 }], [null]);

    const result = service.craft(
      recipe.id,
      before,
      new Set(['cloudcraft:hand_assembly']),
    );

    expect(result).toEqual({ ok: false, reason: 'missing_capability' });
    expect(before.hotbar).toEqual([{ type: ItemType.SAND, count: 1 }]);
  });

  test('rolls back consumed inputs when there is not enough output space', () => {
    const recipe: ProcessRecipe = {
      id: 'cloudcraft:test_inventory_full',
      inputs: [{ role: 'material', selector: { itemType: ItemType.SAND }, count: 1 }],
      steps: [{ capability: 'cloudcraft:hand_assembly' }],
      outputs: [{ type: ItemType.CHEST, count: 101 }],
    };
    const recipes = new ProcessRecipeRegistry();
    recipes.register(recipe);
    const service = new CraftingService(recipes, catalog);
    const before = createInventory([
      { type: ItemType.SAND, count: 1 },
      { type: ItemType.STONE, count: 1 },
    ], []);

    const result = service.craft(
      recipe.id,
      before,
      new Set(['cloudcraft:hand_assembly']),
    );

    expect(result).toEqual({ ok: false, reason: 'inventory_full' });
    expect(before.hotbar).toEqual([
      { type: ItemType.SAND, count: 1 },
      { type: ItemType.STONE, count: 1 },
    ]);
  });

  test('queries craftability without changing the supplied inventory', () => {
    const recipes = createCoreRecipeRegistry();
    const service = new CraftingService(recipes, catalog);
    const before = createInventory(
      [{ type: ItemType.SAND, count: 4 }, null],
      [null],
    );

    expect(service.canCraft(
      'cloudcraft:sandstone',
      before,
      new Set(['cloudcraft:hand_assembly']),
    )).toBe(true);
    expect(before.hotbar).toEqual([{ type: ItemType.SAND, count: 4 }, null]);
  });
});

describe('ProcessRecipeRegistry', () => {
  test('rejects non-positive or non-integer stack counts', () => {
    const recipes = new ProcessRecipeRegistry();

    expect(() => recipes.register({
      id: 'cloudcraft:test_invalid_input_count',
      inputs: [{ role: 'material', selector: { itemType: ItemType.SAND }, count: 0.5 }],
      steps: [{ capability: 'cloudcraft:hand_assembly' }],
      outputs: [{ type: ItemType.GLASS, count: 1 }],
    })).toThrow('invalid ingredient');
    expect(() => recipes.register({
      id: 'cloudcraft:test_invalid_output_count',
      inputs: [{ role: 'material', selector: { itemType: ItemType.SAND }, count: 1 }],
      steps: [{ capability: 'cloudcraft:hand_assembly' }],
      outputs: [{ type: ItemType.GLASS, count: -1 }],
    })).toThrow('invalid output');
  });
});

describe('core process recipes', () => {
  test('separates hand assembly recipes from heat processing recipes', () => {
    const recipes = createCoreRecipeRegistry().getAll();
    const fabricatorRecipe = recipes.find(recipe => recipe.id === 'cloudcraft:fabricator_bench');
    const glassRecipe = recipes.find(recipe => recipe.id === 'cloudcraft:glass');

    expect(fabricatorRecipe?.steps.map(step => step.capability))
      .toEqual(['cloudcraft:hand_assembly']);
    expect(glassRecipe?.steps.map(step => step.capability))
      .toEqual(['cloudcraft:heat']);
  });

  test('uses the item registry as the single source for tags and stack limits', () => {
    const inventory = createInventory(
      [{ type: ItemType.SAND, count: 4 }, null],
      [null],
    );

    expect(coreCraftingService.canCraft(
      'cloudcraft:sandstone',
      inventory,
      HAND_CRAFTING_CAPABILITIES,
    )).toBe(true);
  });

  test('requires the fabricator capability combination for advanced recipes', () => {
    const inventory = createInventory([
      { type: ItemType.STONE, count: 1 },
      { type: ItemType.IRON, count: 1 },
      null,
    ], []);

    expect(coreCraftingService.canCraft(
      'cloudcraft:lever',
      inventory,
      HAND_CRAFTING_CAPABILITIES,
    )).toBe(false);
    expect(coreCraftingService.canCraft(
      'cloudcraft:lever',
      inventory,
      new Set(['cloudcraft:shape', 'cloudcraft:bind']),
    )).toBe(true);
  });
});
