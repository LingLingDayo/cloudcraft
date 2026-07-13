import { DefinitionRegistry } from '@game/foundation/registry/DefinitionRegistry';
import type { ProcessRecipe } from './CraftingTypes';

export class ProcessRecipeRegistry {
  private readonly definitions = new DefinitionRegistry<ProcessRecipe>('process recipe');

  public register(recipe: ProcessRecipe): void {
    if (recipe.inputs.length === 0) {
      throw new Error(`Process recipe ${recipe.id} requires at least one input`);
    }
    if (recipe.outputs.length === 0) {
      throw new Error(`Process recipe ${recipe.id} requires at least one output`);
    }
    for (const input of recipe.inputs) {
      if (
        !Number.isInteger(input.count)
        || input.count <= 0
        || (!input.selector.itemType && !input.selector.tag)
      ) {
        throw new Error(`Process recipe ${recipe.id} has an invalid ingredient`);
      }
    }
    for (const output of recipe.outputs) {
      if (!Number.isInteger(output.count) || output.count <= 0) {
        throw new Error(`Process recipe ${recipe.id} has an invalid output`);
      }
    }
    this.definitions.register(recipe);
  }

  public find(id: string): ProcessRecipe | undefined {
    return this.definitions.find(id);
  }

  public getAll(): readonly ProcessRecipe[] {
    return this.definitions.values();
  }

  public freeze(): void {
    this.definitions.freeze();
  }
}
