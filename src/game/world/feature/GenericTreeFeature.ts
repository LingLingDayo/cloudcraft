import type { WorldFeature } from './WorldFeature';
import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';
import type { TreeConfig } from './tree/types';

// Re-export types
export * from './tree/types';

// Re-export helper
export { placeBranchLeaves } from './tree/foliageHelper';

// Re-export placers
export { StraightTrunkPlacer } from './tree/StraightTrunkPlacer';
export { BranchingTrunkPlacer } from './tree/BranchingTrunkPlacer';
export { MegaJungleTrunkPlacer } from './tree/MegaJungleTrunkPlacer';
export { BlobFoliagePlacer } from './tree/BlobFoliagePlacer';
export { SpruceFoliagePlacer } from './tree/SpruceFoliagePlacer';
export { MegaJungleFoliagePlacer } from './tree/MegaJungleFoliagePlacer';

/**
 * 通用树特征类 (GenericTreeFeature)
 * // Extension Point: 新型树种只需要提供对应的 TreeConfig
 */
export class GenericTreeFeature implements WorldFeature {
  public readonly id: string;
  protected readonly config: TreeConfig;

  constructor(
    id: string,
    config: TreeConfig
  ) {
    this.id = id;
    this.config = config;
  }

  public generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean {
    const dirt = this.config.dirtBlock ?? BLOCK_TYPES.DIRT;

    // 随机计算高度
    const heightRand = random(x, y, z);
    const treeHeight =
      this.config.minHeight +
      Math.floor(Math.abs(heightRand) * this.config.heightVariance);

    // 放置树干并铺设地基
    const trunkPositions = this.config.trunkPlacer.place(
      writer,
      x,
      y,
      z,
      treeHeight,
      this.config.trunkBlock,
      random,
      dirt
    );

    // 放置树冠
    this.config.foliagePlacer.place(
      writer,
      x,
      y,
      z,
      treeHeight,
      this.config.leafBlock,
      trunkPositions,
      random
    );

    return true;
  }
}
