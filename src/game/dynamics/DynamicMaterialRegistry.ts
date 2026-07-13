import { DefinitionRegistry } from '@game/foundation/registry/DefinitionRegistry';

export interface DynamicMaterialDefinition {
  readonly id: string;
  readonly blockIds: readonly number[];
  readonly replaceableBlockIds: readonly number[];
  readonly gravity: number;
  readonly terminalVelocity: number;
}

export interface FallingVoxelWorldPort {
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, blockId: number): void;
  isInWorldBounds(y: number): boolean;
}

export class DynamicMaterialRegistry {
  private readonly definitions = new DefinitionRegistry<DynamicMaterialDefinition>(
    'dynamic material',
  );
  private readonly definitionsByBlockId = new Map<number, DynamicMaterialDefinition>();

  public register(definition: DynamicMaterialDefinition): void {
    if (definition.blockIds.length === 0) {
      throw new Error(`Dynamic material ${definition.id} requires at least one block type`);
    }
    if (definition.gravity >= 0 || definition.terminalVelocity >= 0) {
      throw new Error(`Dynamic material ${definition.id} requires downward velocities`);
    }
    for (const blockId of definition.blockIds) {
      const existing = this.definitionsByBlockId.get(blockId);
      if (existing) {
        throw new Error(`Block ${blockId} already uses dynamic material ${existing.id}`);
      }
    }

    this.definitions.register(definition);
    for (const blockId of definition.blockIds) {
      this.definitionsByBlockId.set(blockId, definition);
    }
  }

  public getByBlockId(blockId: number): DynamicMaterialDefinition | undefined {
    return this.definitionsByBlockId.get(blockId);
  }

  public freeze(): void {
    this.definitions.freeze();
  }
}
