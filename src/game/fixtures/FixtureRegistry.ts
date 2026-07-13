import { DefinitionRegistry } from '@game/foundation/registry/DefinitionRegistry';
import type { FixtureDefinition } from './FixtureTypes';

export class FixtureRegistry {
  private readonly definitions = new DefinitionRegistry<FixtureDefinition>('fixture');

  public register(definition: FixtureDefinition): void {
    if (definition.footprint.length === 0) {
      throw new Error(`Fixture ${definition.id} requires a footprint`);
    }

    const footprintCoordinates = new Set<string>();
    for (const coordinate of definition.footprint) {
      if (
        !Number.isInteger(coordinate.x) ||
        !Number.isInteger(coordinate.y) ||
        !Number.isInteger(coordinate.z)
      ) {
        throw new Error(`Fixture ${definition.id} has an invalid footprint coordinate`);
      }
      const key = `${coordinate.x},${coordinate.y},${coordinate.z}`;
      if (footprintCoordinates.has(key)) {
        throw new Error(`Fixture ${definition.id} has a duplicate footprint coordinate`);
      }
      footprintCoordinates.add(key);
    }

    const componentTypes = new Set<string>();
    for (const component of definition.components) {
      if (componentTypes.has(component.type)) {
        throw new Error(`Fixture ${definition.id} has duplicate ${component.type} components`);
      }
      componentTypes.add(component.type);

      if (
        (component.type === 'container' || component.type === 'fuel') &&
        (!Number.isInteger(component.slots) || component.slots <= 0)
      ) {
        throw new Error(`Fixture ${definition.id} has an invalid ${component.type} capacity`);
      }
      if (component.type === 'crafting' || component.type === 'processor') {
        const capabilities = new Set<string>();
        if (component.capabilities.length === 0) {
          throw new Error(`Fixture ${definition.id} requires a ${component.type} capability`);
        }
        for (const capability of component.capabilities) {
          if (!capability || capabilities.has(capability)) {
            throw new Error(`Fixture ${definition.id} has an invalid ${component.type} capability`);
          }
          capabilities.add(capability);
        }
      }
    }
    this.definitions.register(definition);
  }

  public find(id: string): FixtureDefinition | undefined {
    return this.definitions.find(id);
  }

  public get(id: string): FixtureDefinition {
    return this.definitions.get(id);
  }

  public getAll(): readonly FixtureDefinition[] {
    return this.definitions.values();
  }

  public freeze(): void {
    this.definitions.freeze();
  }
}
