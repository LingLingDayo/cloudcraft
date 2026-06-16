import { BLOCK_TYPES } from '../../BlockConfig';
import type { BlockWriter, RandomProvider } from '../../TreeStructureGenerator';
import type { BlockPos, TrunkPlacer } from './types';

/**
 * 带分叉树干放置器 (BranchingTrunkPlacer)
 * 产生 1x1 普通树干，但在中上部有概率伸出 1 格的细小树枝
 */
export class BranchingTrunkPlacer implements TrunkPlacer {
  public readonly type = 'branching';

  public place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    random: RandomProvider,
    dirtBlock?: number
  ): BlockPos[] {
    const positions: BlockPos[] = [];
    const dirt = dirtBlock ?? BLOCK_TYPES.DIRT;

    // 地基改为泥土
    writer.setBlock(x, y, z, dirt);

    // 生成直立主干
    for (let h = 1; h <= height; h++) {
      const cy = y + h;
      writer.setBlock(x, cy, z, block);
      positions.push({ x, y: cy, z });
    }

    // 随机生成 1 格的细小水平树枝
    const branchMinH = Math.floor(height * 0.5);
    const branchMaxH = height - 2;

    for (let h = branchMinH; h <= branchMaxH; h++) {
      const randVal = random(x, y + h, z);
      if (Math.abs(randVal) < 0.20) {
        // 20% 概率生成侧枝
        const dirIndex = Math.floor(Math.abs(random(x + 1, y + h, z)) * 4);
        let dx = 0;
        let dz = 0;
        if (dirIndex === 0) dx = 1;
        else if (dirIndex === 1) dx = -1;
        else if (dirIndex === 2) dz = 1;
        else dz = -1;

        const bx = x + dx;
        const by = y + h;
        const bz = z + dz;

        if (writer.getBlock(bx, by, bz) === BLOCK_TYPES.AIR) {
          writer.setBlock(bx, by, bz, block);
          positions.push({ x: bx, y: by, z: bz });
        }
      }
    }

    return positions;
  }
}
