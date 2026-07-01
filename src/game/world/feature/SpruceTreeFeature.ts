import { BLOCK_TYPES } from '../BlockConfig';
import {
  GenericTreeFeature,
  BranchingTrunkPlacer,
  SpruceFoliagePlacer
} from './GenericTreeFeature';

export class SpruceTreeFeature extends GenericTreeFeature {
  constructor() {
    super('spruce_tree', {
      trunkBlock: BLOCK_TYPES.SPRUCE_WOOD,
      leafBlock: BLOCK_TYPES.SPRUCE_LEAVES,
      minHeight: 6,
      heightVariance: 3,
      trunkPlacer: new BranchingTrunkPlacer(),
      foliagePlacer: new SpruceFoliagePlacer()
    });
  }
}