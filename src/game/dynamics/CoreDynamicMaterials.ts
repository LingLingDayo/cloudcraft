import { BLOCK_TYPES } from '@type';
import { DynamicMaterialRegistry } from './DynamicMaterialRegistry';
import type { DynamicMaterialDefinition } from './DynamicMaterialRegistry';

const CORE_DYNAMIC_MATERIALS: readonly DynamicMaterialDefinition[] = [
  {
    id: 'cloudcraft:sand_fall',
    blockIds: [BLOCK_TYPES.SAND],
    replaceableBlockIds: [BLOCK_TYPES.AIR, BLOCK_TYPES.WATER],
    gravity: -24,
    terminalVelocity: -35,
  },
];

export function createCoreDynamicMaterialRegistry(): DynamicMaterialRegistry {
  const registry = new DynamicMaterialRegistry();
  for (const definition of CORE_DYNAMIC_MATERIALS) {
    registry.register(definition);
  }
  registry.freeze();
  return registry;
}
