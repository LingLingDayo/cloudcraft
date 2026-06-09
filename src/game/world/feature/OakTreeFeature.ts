import type { WorldFeature } from './WorldFeature';
import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';

export class OakTreeFeature implements WorldFeature {
  public readonly id = 'oak_tree';

  public generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean {
    // 基础配置
    const trunkBlock = BLOCK_TYPES.WOOD;
    const leafBlock = BLOCK_TYPES.LEAF;
    
    // 随机计算高度 (从外部传入或根据坐标局部随机算)
    // 根据原始实现：Oak 的高度是 4 ~ 5。
    // 在这里我们可以使用局部随机算一个，或者从 config 提取。
    // 为了兼容原逻辑，我们通过 random 算一个 heightRand
    const heightRand = random(x, y, z);
    const treeHeight = 4 + Math.floor(Math.abs(heightRand) * 2); // 4 or 5

    // 地基转化为泥土
    writer.setBlock(x, y, z, BLOCK_TYPES.DIRT);

    // 生成树干
    for (let h = 1; h <= treeHeight; h++) {
      writer.setBlock(x, y + h, z, trunkBlock);
    }

    // 生成树冠
    const leafCenterY = y + treeHeight + 1;
    for (let ly = -2; ly <= 1; ly++) {
      const radius = ly === 1 ? 1 : 2;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly <= 0) continue;

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
