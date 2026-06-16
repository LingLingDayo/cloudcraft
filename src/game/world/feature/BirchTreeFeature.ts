import { BLOCK_TYPES } from '../BlockConfig';
import {
  GenericTreeFeature,
  StraightTrunkPlacer,
  BlobFoliagePlacer
} from './GenericTreeFeature';

export class BirchTreeFeature extends GenericTreeFeature {
  constructor() {
    super('birch_tree', {
      trunkBlock: BLOCK_TYPES.BIRCH_WOOD,
      leafBlock: BLOCK_TYPES.BIRCH_LEAVES,
      minHeight: 5,
      heightVariance: 3,
      trunkPlacer: new StraightTrunkPlacer(),
      foliagePlacer: new BlobFoliagePlacer({
        minLy: -3,
        maxLy: 1,
        radiusProvider: (ly) => (ly === 1 ? 1 : 2),
        excludeCornersLayers: [-3],
        discardChance: 0.20
      })
    });
  }
}
