import { BLOCK_TYPES } from '../../BlockConfig';
import type { BlockWriter, RandomProvider } from '../../TreeStructureGenerator';
import type { BlockPos, TrunkPlacer } from './types';

/**
 * 直立树干放置器 (StraightTrunkPlacer)
 * 支持最底层树干下方铺设泥土地基
 */
export class StraightTrunkPlacer implements TrunkPlacer {
  public readonly type = 'straight';

  public place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    _random: RandomProvider,
    dirtBlock?: number
  ): BlockPos[] {
    const positions: BlockPos[] = [];
    const dirt = dirtBlock ?? BLOCK_TYPES.DIRT;

    // 地基改为泥土
    writer.setBlock(x, y, z, dirt);

    for (let h = 1; h <= height; h++) {
      const cy = y + h;
      writer.setBlock(x, cy, z, block);
      positions.push({ x, y: cy, z });
    }
    return positions;
  }
}
