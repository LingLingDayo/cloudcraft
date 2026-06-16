import { BLOCK_TYPES } from '../../BlockConfig';
import type { BlockWriter } from '../../TreeStructureGenerator';
import type { BlockPos } from './types';

/**
 * 公共辅助函数：在主干范围外的侧枝节点周围放置微型圆球状树叶簇
 * @param trunkWidth 1 表示 1x1 树干，2 表示 2x2 树干
 */
export function placeBranchLeaves(
  writer: BlockWriter,
  x: number,
  z: number,
  trunkPositions: BlockPos[],
  block: number,
  trunkWidth: 1 | 2
): void {
  const isMainTrunk = (px: number, pz: number): boolean => {
    if (trunkWidth === 1) {
      return px === x && pz === z;
    } else {
      return px >= x && px <= x + 1 && pz >= z && pz <= z + 1;
    }
  };

  const branchPositions = trunkPositions.filter(
    (pos) => !isMainTrunk(pos.x, pos.z)
  );

  for (const branch of branchPositions) {
    // 侧枝叶簇：在每个侧枝节点周围生成一个微型圆球树叶簇 (dy 从 -1 到 1)
    for (let dy = -1; dy <= 1; dy++) {
      const radius = dy === 1 ? 0 : 1; // 顶层半径为 0，其它层为 1
      const minX = -radius;
      const maxX = radius;
      const minZ = -radius;
      const maxZ = radius;

      for (let dx = minX; dx <= maxX; dx++) {
        for (let dz = minZ; dz <= maxZ; dz++) {
          // 仅当半径为 1 时过滤角落，形成圆形
          if (radius > 0 && Math.abs(dx) === radius && Math.abs(dz) === radius) {
            continue;
          }

          const wlx = branch.x + dx;
          const wly = branch.y + dy;
          const wlz = branch.z + dz;

          if (writer.getBlock(wlx, wly, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, wly, wlz, block);
          }
        }
      }
    }
  }
}
