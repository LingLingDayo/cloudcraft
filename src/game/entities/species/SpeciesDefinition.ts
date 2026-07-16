import type * as THREE from 'three';
import type { World } from '@game/world/World';
import type { Animal } from '../Animal';

export interface SpeciesHabitatSample {
  readonly biomeId: string;
  readonly vegetationDensity: number;
  readonly surfaceBlockId: number;
}

/** 对人类敌对时的捕猎/近战参数；由 Animal 底座统一消费，禁止物种硬编码分支。 */
export interface SpeciesCombatProfile {
  readonly awarenessDistance: number;
  readonly attackDistance: number;
  readonly attackDamage: number;
  readonly attackIntervalSeconds: number;
  readonly stalkingSpeed: number;
  readonly attackSpeed: number;
  readonly requireLineOfSight: boolean;
}

export interface SpeciesDefinition {
  readonly id: string;
  readonly spawnWeight: number;
  readonly movementModeIds: readonly string[];
  /** 是否对人类敌对；为 true 时必须同时提供 combat 配置。 */
  readonly hostileToHumans: boolean;
  /** 敌对物种的战斗档案；非敌对物种必须省略。 */
  readonly combat?: SpeciesCombatProfile;
  scoreHabitat(sample: SpeciesHabitatSample): number;
  create(id: string, spawnPosition: THREE.Vector3, world: World): Animal;
}
