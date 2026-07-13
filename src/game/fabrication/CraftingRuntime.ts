import { ItemRegistry } from '@game/item/ItemRegistry';
import { CraftingService } from './CraftingService';
import { CraftingCapability, createCoreRecipeRegistry } from './CoreRecipes';
import type { CraftingCapabilityId, CraftingItemCatalog } from './CraftingTypes';

const itemCatalog: CraftingItemCatalog = {
  hasTag: (itemType, tag) => ItemRegistry.hasTag(itemType, tag),
  getMaxStackSize: itemType => ItemRegistry.get(itemType).maxStackSize,
};

export const HAND_CRAFTING_CAPABILITIES: ReadonlySet<CraftingCapabilityId> = new Set([
  CraftingCapability.HAND_ASSEMBLY,
]);

export const coreCraftingService = new CraftingService(
  createCoreRecipeRegistry(),
  itemCatalog,
);
