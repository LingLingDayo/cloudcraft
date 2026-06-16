import { BLOCK_TYPES } from '../BlockConfig';
import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import {
  GenericTreeFeature,
  BranchingTrunkPlacer,
  MegaJungleTrunkPlacer,
  BlobFoliagePlacer,
  MegaJungleFoliagePlacer,
  type TreeConfig
} from './GenericTreeFeature';

export class JungleTreeFeature extends GenericTreeFeature {
  private readonly smallTreeConfig: TreeConfig;
  private readonly megaTreeConfig: TreeConfig;

  constructor() {
    // 默认回退配置
    const defaultSmall: TreeConfig = {
      trunkBlock: BLOCK_TYPES.JUNGLE_WOOD,
      leafBlock: BLOCK_TYPES.JUNGLE_LEAVES,
      minHeight: 7,
      heightVariance: 5,
      trunkPlacer: new BranchingTrunkPlacer(),
      foliagePlacer: new BlobFoliagePlacer({
        minLy: -3,
        maxLy: 1,
        radiusProvider: (ly) => (ly === 1 ? 1 : ly === -3 ? 1 : 2),
        excludeCornersLayers: [0, -1, -2],
        discardChance: 0.10
      })
    };

    super('jungle_tree', defaultSmall);

    this.smallTreeConfig = defaultSmall;

    this.megaTreeConfig = {
      trunkBlock: BLOCK_TYPES.JUNGLE_WOOD,
      leafBlock: BLOCK_TYPES.JUNGLE_LEAVES,
      minHeight: 16,
      heightVariance: 12,
      trunkPlacer: new MegaJungleTrunkPlacer(),
      foliagePlacer: new MegaJungleFoliagePlacer({
        minLy: -3,
        maxLy: 2,
        radiusProvider: (ly) => (ly === 2 ? 0 : (ly === -3 ? 1 : (ly === 1 ? 1 : 2))),
        excludeCornersLayers: [1, 0, -1, -2, -3],
        discardChance: 0.10
      })
    };
  }

  public override generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean {
    // 依据本地伪随机数，决定生成巨型丛林大树 (25% 概率) 还是普通丛林小树 (75% 概率)
    const typeRand = random(x, y, z);
    const isMega = Math.abs(typeRand) < 0.25;
    const config = isMega ? this.megaTreeConfig : this.smallTreeConfig;

    const dirt = config.dirtBlock ?? BLOCK_TYPES.DIRT;

    // 随机计算高度
    const heightRand = random(x + 1, y, z + 1);
    const treeHeight =
      config.minHeight +
      Math.floor(Math.abs(heightRand) * config.heightVariance);

    // 放置树干（包括分叉/大侧枝，并做地基转换）
    const trunkPositions = config.trunkPlacer.place(
      writer,
      x,
      y,
      z,
      treeHeight,
      config.trunkBlock,
      random,
      dirt
    );

    // 放置主树冠及侧枝叶簇
    config.foliagePlacer.place(
      writer,
      x,
      y,
      z,
      treeHeight,
      config.leafBlock,
      trunkPositions,
      random
    );

    return true;
  }
}
