import { BLOCK_TYPES } from '../../BlockConfig';
import type { BlockWriter, RandomProvider } from '../../TreeStructureGenerator';
import type { BlockPos, FoliagePlacer } from './types';
import { placeBranchLeaves } from './foliageHelper';

/**
 * 球形/柱状通用树冠放置器 (BlobFoliagePlacer)
 * 适用于橡树、桦树、丛林树等标准树叶簇
 */
export class BlobFoliagePlacer implements FoliagePlacer {
  public readonly type = 'blob';

  private readonly config: {
    minLy: number;
    maxLy: number;
    radiusProvider: (ly: number) => number;
    excludeCornersLayers?: number[];
    discardChance?: number;
  };

  constructor(
    config: {
      minLy: number;
      maxLy: number;
      radiusProvider: (ly: number) => number;
      excludeCornersLayers?: number[];
      discardChance?: number;
    }
  ) {
    this.config = config;
  }

  public place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    trunkPositions: BlockPos[],
    random: RandomProvider
  ): void {
    const leafCenterY = y + height + 1;
    const {
      minLy,
      maxLy,
      radiusProvider,
      excludeCornersLayers = [],
      discardChance = 0
    } = this.config;

    // 1. 生成树顶主树冠
    for (let ly = minLy; ly <= maxLy; ly++) {
      const radius = radiusProvider(ly);
      if (radius <= 0) continue;

      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          // 树干中低部（ly <= 0 且在中心）不覆盖树叶
          if (lx === 0 && lz === 0 && ly <= 0) continue;

          // 剔除指定层数的角落位置
          const isCorner = Math.abs(lx) === radius && Math.abs(lz) === radius;
          if (isCorner && excludeCornersLayers.includes(ly)) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;
          const wly = leafCenterY + ly;

          // 外侧边缘树叶随机不生成 (模拟自然破损风格)
          const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
          if (isOuter && !(lx === 0 && lz === 0) && discardChance > 0) {
            const leafRand = random(wlx, wly, wlz);
            if (leafRand < discardChance) {
              continue;
            }
          }

          if (writer.getBlock(wlx, wly, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, wly, wlz, block);
          }
        }
      }
    }

    // 2. 为侧枝生成小叶簇
    placeBranchLeaves(writer, x, z, trunkPositions, block, 1);
  }
}
