import type { WorldFeature } from './WorldFeature';
import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';

export class BirchTreeFeature implements WorldFeature {
  public readonly id = 'birch_tree';

  public generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean {
    const trunkBlock = BLOCK_TYPES.BIRCH_WOOD;
    const leafBlock = BLOCK_TYPES.BIRCH_LEAVES;

    // 高度范围为 5 ~ 7
    const heightRand = random(x, y, z);
    const treeHeight = 5 + Math.floor(Math.abs(heightRand) * 3);

    // 地基转化为泥土
    writer.setBlock(x, y, z, BLOCK_TYPES.DIRT);

    // 生成树干
    for (let h = 1; h <= treeHeight; h++) {
      writer.setBlock(x, y + h, z, trunkBlock);
    }

    // 生成树冠
    const leafCenterY = y + treeHeight + 1;
    for (let ly = -3; ly <= 1; ly++) {
      const radius = ly === 1 ? 1 : 2;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly <= 0) continue;

          // 桦树在 ly === -3 时剔除角落
          if (ly === -3 && Math.abs(lx) === radius && Math.abs(lz) === radius) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;
          const wly = leafCenterY + ly;

          const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
          if (isOuter && !(lx === 0 && lz === 0)) {
            const leafRand = random(wlx, wly, wlz);
            if (leafRand < 0.20) {
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
