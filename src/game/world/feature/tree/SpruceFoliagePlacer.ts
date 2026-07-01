import { BLOCK_TYPES } from '../../BlockConfig';
import type { BlockWriter, RandomProvider } from '../../TreeStructureGenerator';
import type { BlockPos, FoliagePlacer } from './types';

/**
 * 云杉专用的塔状松针树冠放置器 (SpruceFoliagePlacer)
 *
 * 每层叶簇以 4 根 1 格长的小枝干从主干伸出作为骨架，
 * 叶片围绕枝干末端展开，避免"只有叶子没有枝干"的悬浮问题。
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
    const trunkBlock = BLOCK_TYPES.SPRUCE_WOOD;

    for (let ly = -4; ly <= 1; ly++) {
      let radius = 0;
      if (ly === 1) radius = 0;
      else if (ly === 0) radius = 1;
      else if (ly === -1) radius = 2;
      else if (ly === -2) radius = 1;
      else if (ly === -3) radius = 2;
      else if (ly === -4) radius = 2;

      if (radius <= 0) continue;

      const layerY = leafCenterY + ly;

      // 对半径 >= 2 的叶层，从主干向四个方向各伸出 1 格小枝干
      if (radius >= 2) {
        const branchDirections = [
          { dx: 1, dz: 0 },
          { dx: -1, dz: 0 },
          { dx: 0, dz: 1 },
          { dx: 0, dz: -1 },
        ];

        for (const dir of branchDirections) {
          const bx = x + dir.dx;
          const bz = z + dir.dz;

          // 只在目标位置为空气时放置枝干，避免覆盖已有方块
          if (writer.getBlock(bx, layerY, bz) === BLOCK_TYPES.AIR) {
            writer.setBlock(bx, layerY, bz, trunkBlock);
          }
        }
      }

      // 放置叶片
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          // 跳过主干位置（已有主干方块）
          if (lx === 0 && lz === 0) continue;

          // 半径为 2 时，剔除 4 个角落
          if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;

          // 半径 >= 2 时，枝干位置 (|lx|==1 且 |lz|==0，或 |lx|==0 且 |lz|==1) 已经放了木头，不覆盖
          if (radius >= 2 && (Math.abs(lx) + Math.abs(lz)) === 1) {
            continue;
          }

          // 外层叶子随机剔除，增加自然感
          const isOuter = Math.abs(lx) === radius || Math.abs(lz) === radius;
          if (isOuter) {
            const leafRand = random(wlx, layerY, wlz);
            if (leafRand < 0.20) {
              continue;
            }
          }

          if (writer.getBlock(wlx, layerY, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, layerY, wlz, block);
          }
        }
      }
    }
  }
}