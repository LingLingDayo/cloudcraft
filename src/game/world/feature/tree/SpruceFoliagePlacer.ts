import { BLOCK_TYPES } from '../../BlockConfig';
import type { BlockWriter, RandomProvider } from '../../TreeStructureGenerator';
import type { BlockPos, FoliagePlacer } from './types';

/**
 * 云杉专用的塔状松针树冠放置器 (SpruceFoliagePlacer)
 */
export class SpruceFoliagePlacer implements FoliagePlacer {
  public readonly type = 'spruce';

  public place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    _trunkPositions: BlockPos[],
    random: RandomProvider
  ): void {
    const leafCenterY = y + height + 1;

    for (let ly = -4; ly <= 1; ly++) {
      let radius = 1;
      if (ly === 1) radius = 0;
      else if (ly === 0) radius = 1;
      else if (ly === -1) radius = 2;
      else if (ly === -2) radius = 1;
      else if (ly === -3) radius = 2;
      else if (ly === -4) radius = 2;

      if (radius <= 0) continue;

      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly <= 0) continue;

          // 半径为 2 时，剔除 4 个角落
          if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;
          const wly = leafCenterY + ly;

          // 外层叶子随机剔除
          const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
          if (isOuter && !(lx === 0 && lz === 0)) {
            const leafRand = random(wlx, wly, wlz);
            if (leafRand < 0.20) {
              continue;
            }
          }

          if (writer.getBlock(wlx, wly, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, wly, wlz, block);
          }
        }
      }
    }
  }
}
