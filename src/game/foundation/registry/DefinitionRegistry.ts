export interface IdentifiedDefinition {
  readonly id: string;
}

export class DefinitionRegistry<TDefinition extends IdentifiedDefinition> {
  private readonly definitionName: string;
  private readonly definitions = new Map<string, TDefinition>();
  private frozen = false;

  public constructor(definitionName: string) {
    this.definitionName = definitionName;
  }

  public register(definition: TDefinition): void {
    if (this.frozen) {
      throw new Error(`${this.definitionName} registry is frozen`);
    }
    if (this.definitions.has(definition.id)) {
      throw new Error(`Duplicate ${this.definitionName} definition: ${definition.id}`);
    }
    this.definitions.set(definition.id, definition);
  }

  public get(id: string): TDefinition {
    const definition = this.definitions.get(id);
    if (!definition) {
      throw new Error(`Unknown ${this.definitionName} definition: ${id}`);
    }
    return definition;
  }

  public find(id: string): TDefinition | undefined {
    return this.definitions.get(id);
  }

  public has(id: string): boolean {
    return this.definitions.has(id);
  }

  public values(): readonly TDefinition[] {
    return Array.from(this.definitions.values());
  }

  public freeze(): void {
    this.frozen = true;
  }

  public get isFrozen(): boolean {
    return this.frozen;
  }
}
