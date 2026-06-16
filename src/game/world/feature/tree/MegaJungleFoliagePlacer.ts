import { BLOCK_TYPES } from '../../BlockConfig';
import type { BlockWriter, RandomProvider } from '../../TreeStructureGenerator';
import type { BlockPos, FoliagePlacer } from './types';
import { placeBranchLeaves } from './foliageHelper';

/**
 * 2x2 巨型丛林树冠放置器 (MegaJungleFoliagePlacer)
 * 围绕 2x2 树冠生成宽大叶冠，并在侧枝末梢挂载小十字叶簇
 */
export class MegaJungleFoliagePlacer implements FoliagePlacer {
  public readonly type = 'mega_jungle';

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

    // 1. 生成顶端巨型 2x2 对称主树冠
    for (let ly = minLy; ly <= maxLy; ly++) {
      const radius = radiusProvider(ly);
      if (radius <= 0) continue;

      const minX = -radius;
      const maxX = 1 + radius;
      const minZ = -radius;
      const maxZ = 1 + radius;

      for (let lx = minX; lx <= maxX; lx++) {
        for (let lz = minZ; lz <= maxZ; lz++) {
          const inTrunk = lx >= 0 && lx <= 1 && lz >= 0 && lz <= 1;
          if (inTrunk && ly <= 0) continue;

          // 剔除 2x2 四周边角的叶子
          const isCorner = (lx === minX || lx === maxX) && (lz === minZ || lz === maxZ);
          if (isCorner && excludeCornersLayers.includes(ly)) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;
          const wly = leafCenterY + ly;

          const isOuter = lx === minX || lx === maxX || lz === minZ || lz === maxZ;
          if (isOuter && !inTrunk && discardChance > 0) {
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

    // 2. 为侧枝生成十字小叶簇
    placeBranchLeaves(writer, x, z, trunkPositions, block, 2);
  }
}
