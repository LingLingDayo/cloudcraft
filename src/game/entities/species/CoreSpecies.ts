import { BLOCK_TYPES } from '@type';
import { Pig } from '../Pig';
import { Leopard } from '../Leopard';
import { CoreMovementModeId } from '../movement/CoreMovementModes';
import { SpeciesRegistry } from './SpeciesRegistry';
import type { SpeciesCombatProfile, SpeciesDefinition } from './SpeciesDefinition';

const LEOPARD_HABITAT_BIOMES = new Set(['forest', 'jungle', 'taiga']);
const TERRESTRIAL_MOVEMENT_MODE_IDS = [
  CoreMovementModeId.SWIM,
  CoreMovementModeId.GROUND,
] as const;

export const LEOPARD_COMBAT_PROFILE: SpeciesCombatProfile = {
  awarenessDistance: 14,
  attackDistance: 1.6,
  attackDamage: 2,
  attackIntervalSeconds: 1.1,
  stalkingSpeed: 3.6,
  attackSpeed: 5.2,
  requireLineOfSight: true,
};

const CORE_SPECIES: readonly SpeciesDefinition[] = [
  {
    id: 'cloudcraft:pig',
    spawnWeight: 1,
    movementModeIds: TERRESTRIAL_MOVEMENT_MODE_IDS,
    hostileToHumans: false,
    scoreHabitat: sample => sample.surfaceBlockId === BLOCK_TYPES.GRASS ? 1 : 0,
    create: (id, spawnPosition, world) => new Pig(
      id,
      spawnPosition,
      world,
      TERRESTRIAL_MOVEMENT_MODE_IDS,
    ),
  },
  {
    id: 'cloudcraft:leopard',
    spawnWeight: 0.08,
    movementModeIds: TERRESTRIAL_MOVEMENT_MODE_IDS,
    hostileToHumans: true,
    combat: LEOPARD_COMBAT_PROFILE,
    scoreHabitat: sample => {
      if (sample.surfaceBlockId !== BLOCK_TYPES.GRASS) return 0;
      if (LEOPARD_HABITAT_BIOMES.has(sample.biomeId)) {
        return 0.8 + sample.vegetationDensity * 0.5;
      }
      return 0.02 + sample.vegetationDensity * 0.03;
    },
    create: (id, spawnPosition, world) => new Leopard(
      id,
      spawnPosition,
      world,
      TERRESTRIAL_MOVEMENT_MODE_IDS,
      { combat: LEOPARD_COMBAT_PROFILE },
    ),
  },
];

export function createCoreSpeciesRegistry(): SpeciesRegistry {
  const registry = new SpeciesRegistry();
  for (const definition of CORE_SPECIES) {
    registry.register(definition);
  }
  registry.freeze();
  return registry;
}
