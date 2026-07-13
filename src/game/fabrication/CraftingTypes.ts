import type { ItemStack, ItemType } from '@type';

export type CraftingCapabilityId = string;
export type IngredientRole = 'structure' | 'binding' | 'catalyst' | 'fuel' | 'material';

export interface IngredientSelector {
  readonly itemType?: ItemType;
  readonly tag?: string;
}

export interface IngredientRequirement {
  readonly role: IngredientRole;
  readonly selector: IngredientSelector;
  readonly count: number;
}

export interface ProcessStep {
  readonly capability: CraftingCapabilityId;
  readonly durationSeconds?: number;
}

export interface ProcessRecipe {
  readonly id: string;
  readonly inputs: readonly IngredientRequirement[];
  readonly steps: readonly ProcessStep[];
  readonly outputs: readonly ItemStack[];
}

export interface InventoryState {
  readonly hotbar: readonly (ItemStack | null)[];
  readonly inventory: readonly (ItemStack | null)[];
}

export interface CraftingItemCatalog {
  hasTag(itemType: ItemType, tag: string): boolean;
  getMaxStackSize(itemType: ItemType): number;
}

export type CraftingFailureReason =
  | 'unknown_recipe'
  | 'missing_capability'
  | 'missing_ingredients'
  | 'inventory_full';

export type CraftingResult =
  | { readonly ok: true; readonly inventory: InventoryState }
  | { readonly ok: false; readonly reason: CraftingFailureReason };
