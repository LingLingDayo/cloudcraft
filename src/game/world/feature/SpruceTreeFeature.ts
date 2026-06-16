import { BLOCK_TYPES } from '../BlockConfig';
import {
  GenericTreeFeature,
  StraightTrunkPlacer,
  SpruceFoliagePlacer
} from './GenericTreeFeature';

export class SpruceTreeFeature extends GenericTreeFeature {
  constructor() {
    super('spruce_tree', {
      trunkBlock: BLOCK_TYPES.SPRUCE_WOOD,
      leafBlock: BLOCK_TYPES.SPRUCE_LEAVES,
      minHeight: 6,
      heightVariance: 3,
      trunkPlacer: new StraightTrunkPlacer(),
      foliagePlacer: new SpruceFoliagePlacer()
    });
  }
}
