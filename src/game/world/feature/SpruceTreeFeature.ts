import type { WorldFeature } from './WorldFeature';
import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';

export class SpruceTreeFeature implements WorldFeature {
  public readonly id = 'spruce_tree';

  public generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean {
    const trunkBlock = BLOCK_TYPES.SPRUCE_WOOD;
    const leafBlock = BLOCK_TYPES.SPRUCE_LEAVES;

    // 高度范围为 6 ~ 8
    const heightRand = random(x, y, z);
    const treeHeight = 6 + Math.floor(Math.abs(heightRand) * 3);

    // 地基转化为泥土
    writer.setBlock(x, y, z, BLOCK_TYPES.DIRT);

    // 生成树干
    for (let h = 1; h <= treeHeight; h++) {
      writer.setBlock(x, y + h, z, trunkBlock);
    }

    // 生成树冠
    const leafCenterY = y + treeHeight + 1;
    for (let ly = -4; ly <= 1; ly++) {
      let radius = 1;
      if (ly === 1) radius = 0;
      else if (ly === 0) radius = 1;
      else if (ly === -1) radius = 2;
      else if (ly === -2) radius = 1;
      else if (ly === -3) radius = 2;
      else if (ly === -4) radius = 2;

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
