import { DefinitionRegistry } from '@game/foundation/registry/DefinitionRegistry';
import type {
  SpeciesCombatProfile,
  SpeciesDefinition,
  SpeciesHabitatSample,
} from './SpeciesDefinition';

function assertCombatProfile(speciesId: string, combat: SpeciesCombatProfile): void {
  const positiveFields: Array<keyof SpeciesCombatProfile> = [
    'awarenessDistance',
    'attackDistance',
    'attackDamage',
    'attackIntervalSeconds',
    'stalkingSpeed',
    'circlingDistance',
    'pounceDistance',
    'circlingSpeed',
    'pounceSpeed',
    'recoverySpeed',
    'circlingDurationSeconds',
    'pounceWindupSeconds',
    'pounceDurationSeconds',
    'recoveryDurationSeconds',
  ];
  for (const field of positiveFields) {
    const value = combat[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`Species ${speciesId} combat.${field} must be a positive finite number`);
    }
  }
  if (combat.attackDistance > combat.awarenessDistance) {
    throw new Error(
      `Species ${speciesId} combat.attackDistance cannot exceed awarenessDistance`,
    );
  }
  if (
    combat.attackDistance > combat.pounceDistance
    || combat.pounceDistance > combat.circlingDistance
    || combat.circlingDistance > combat.awarenessDistance
  ) {
    throw new Error(
      `Species ${speciesId} combat distances must satisfy attack <= pounce <= circling <= awareness`,
    );
  }
}

export class SpeciesRegistry {
  private readonly definitions = new DefinitionRegistry<SpeciesDefinition>('species');

  public register(definition: SpeciesDefinition): void {
    if (definition.spawnWeight <= 0) {
      throw new Error(`Species ${definition.id} requires a positive spawn weight`);
    }
    if (definition.hostileToHumans && !definition.combat) {
      throw new Error(
        `Species ${definition.id} is hostileToHumans but missing combat profile`,
      );
    }
    if (!definition.hostileToHumans && definition.combat) {
      throw new Error(
        `Species ${definition.id} provides combat profile but hostileToHumans is false`,
      );
    }
    if (definition.combat) {
      assertCombatProfile(definition.id, definition.combat);
    }
    this.definitions.register(definition);
  }

  public get(id: string): SpeciesDefinition {
    return this.definitions.get(id);
  }

  public find(id: string): SpeciesDefinition | undefined {
    return this.definitions.find(id);
  }

  public getAll(): readonly SpeciesDefinition[] {
    return this.definitions.values();
  }

  public selectForHabitat(
    sample: SpeciesHabitatSample,
    randomValue: number,
  ): SpeciesDefinition | null {
    const weighted = this.getAll().map(definition => ({
      definition,
      weight: Math.max(0, definition.spawnWeight * definition.scoreHabitat(sample)),
    }));
    const totalWeight = weighted.reduce((total, candidate) => total + candidate.weight, 0);
    if (totalWeight <= 0) return null;

    let cursor = Math.min(Math.max(randomValue, 0), 0.999999999) * totalWeight;
    for (const candidate of weighted) {
      cursor -= candidate.weight;
      if (cursor < 0) return candidate.definition;
    }
    return weighted[weighted.length - 1].definition;
  }

  public freeze(): void {
    this.definitions.freeze();
  }
}
