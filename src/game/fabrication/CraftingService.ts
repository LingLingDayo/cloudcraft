import { executeCraftingTransaction } from './InventoryTransaction';
import type {
  CraftingCapabilityId,
  CraftingItemCatalog,
  CraftingResult,
  InventoryState,
  ProcessRecipe,
} from './CraftingTypes';
import type { ProcessRecipeRegistry } from './ProcessRecipeRegistry';

export class CraftingService {
  private readonly recipes: ProcessRecipeRegistry;
  private readonly itemCatalog: CraftingItemCatalog;

  public constructor(
    recipes: ProcessRecipeRegistry,
    itemCatalog: CraftingItemCatalog,
  ) {
    this.recipes = recipes;
    this.itemCatalog = itemCatalog;
  }

  public getRecipes(): readonly ProcessRecipe[] {
    return this.recipes.getAll();
  }

  public craft(
    recipeId: string,
    inventory: InventoryState,
    capabilities: ReadonlySet<CraftingCapabilityId>,
  ): CraftingResult {
    const recipe = this.recipes.find(recipeId);
    if (!recipe) {
      return { ok: false, reason: 'unknown_recipe' };
    }
    if (recipe.steps.some(step => !capabilities.has(step.capability))) {
      return { ok: false, reason: 'missing_capability' };
    }
    return executeCraftingTransaction(
      inventory,
      recipe.inputs,
      recipe.outputs,
      this.itemCatalog,
    );
  }

  public canCraft(
    recipeId: string,
    inventory: InventoryState,
    capabilities: ReadonlySet<CraftingCapabilityId>,
  ): boolean {
    return this.craft(recipeId, inventory, capabilities).ok;
  }
}
