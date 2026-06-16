import { BLOCK_TYPES } from '../BlockConfig';
import {
  GenericTreeFeature,
  StraightTrunkPlacer,
  BlobFoliagePlacer
} from './GenericTreeFeature';

export class OakTreeFeature extends GenericTreeFeature {
  constructor() {
    super('oak_tree', {
      trunkBlock: BLOCK_TYPES.WOOD,
      leafBlock: BLOCK_TYPES.LEAF,
      minHeight: 4,
      heightVariance: 2,
      trunkPlacer: new StraightTrunkPlacer(),
      foliagePlacer: new BlobFoliagePlacer({
        minLy: -2,
        maxLy: 1,
        radiusProvider: (ly) => (ly === 1 ? 1 : 2),
        discardChance: 0.20
      })
    });
  }
}
