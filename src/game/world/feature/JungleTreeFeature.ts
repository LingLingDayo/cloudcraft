import type { WorldFeature } from './WorldFeature';
import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';

export class JungleTreeFeature implements WorldFeature {
  public readonly id = 'jungle_tree';

  public generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean {
    const trunkBlock = BLOCK_TYPES.JUNGLE_WOOD;
    const leafBlock = BLOCK_TYPES.JUNGLE_LEAVES;

    // 高度范围为 7 ~ 11
    const heightRand = random(x, y, z);
    const treeHeight = 7 + Math.floor(Math.abs(heightRand) * 5);

    // 地基转化为泥土
    writer.setBlock(x, y, z, BLOCK_TYPES.DIRT);

    // 生成树干
    for (let h = 1; h <= treeHeight; h++) {
      writer.setBlock(x, y + h, z, trunkBlock);
    }

    // 生成树冠
    const leafCenterY = y + treeHeight + 1;
    for (let ly = -3; ly <= 1; ly++) {
      const radius = ly === 1 ? 1 : (ly === -3 ? 1 : 2);
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly <= 0) continue;

          // 当半径为 2 时，剔除角落
          if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;
          const wly = leafCenterY + ly;

          const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
          if (isOuter && !(lx === 0 && lz === 0)) {
            const leafRand = random(wlx, wly, wlz);
            if (leafRand < 0.10) {
              continue;
            }
          }

          if (writer.getBlock(wlx, wly, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, wly, wlz, leafBlock);
          }
        }
      }
    }

    return true;
  }
}
