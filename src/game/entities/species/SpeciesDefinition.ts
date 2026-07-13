import type * as THREE from 'three';
import type { World } from '@game/world/World';
import type { Animal } from '../Animal';

export interface SpeciesHabitatSample {
  readonly biomeId: string;
  readonly vegetationDensity: number;
  readonly surfaceBlockId: number;
}

export interface SpeciesDefinition {
  readonly id: string;
  readonly spawnWeight: number;
  readonly movementModeIds: readonly string[];
  readonly hostileToHumans: boolean;
  scoreHabitat(sample: SpeciesHabitatSample): number;
  create(id: string, spawnPosition: THREE.Vector3, world: World): Animal;
}
