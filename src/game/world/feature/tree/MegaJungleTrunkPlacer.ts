import { BLOCK_TYPES } from '../../BlockConfig';
import type { BlockWriter, RandomProvider } from '../../TreeStructureGenerator';
import type { BlockPos, TrunkPlacer } from './types';

/**
 * 2x2 巨型丛林树干放置器 (MegaJungleTrunkPlacer)
 * 放置 2x2 的主干并斜向生出大侧枝，其下方的 2x2 基底自动转为泥土
 */
export class MegaJungleTrunkPlacer implements TrunkPlacer {
  public readonly type = 'mega_jungle';

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

    // 1. 将 2x2 的底座下方设为泥土
    writer.setBlock(x, y, z, dirt);
    writer.setBlock(x + 1, y, z, dirt);
    writer.setBlock(x, y, z + 1, dirt);
    writer.setBlock(x + 1, y, z + 1, dirt);

    // 2. 生成 2x2 的巨型树干立柱
    for (let h = 1; h <= height; h++) {
      const cy = y + h;
      const trunkCoords = [
        { x, y: cy, z },
        { x: x + 1, y: cy, z },
        { x, y: cy, z: z + 1 },
        { x: x + 1, y: cy, z: z + 1 }
      ];

      for (const coord of trunkCoords) {
        writer.setBlock(coord.x, coord.y, coord.z, block);
        positions.push(coord);
      }
    }

    // 3. 随机生成斜向延伸的粗大侧枝
    const branchMinH = Math.floor(height * 0.35);
    const branchMaxH = height - 4;

    for (let h = branchMinH; h <= branchMaxH; h += 3) {
      const randVal = random(x, y + h, z);
      if (Math.abs(randVal) < 0.35) {
        // 35% 概率生成侧枝
        const dirIndex = Math.floor(Math.abs(random(x + 2, y + h, z)) * 4);
        let dx = 0;
        let dz = 0;
        let startX = x;
        let startZ = z;

        if (dirIndex === 0) {
          dx = 1; startX = x + 1; // 东
        } else if (dirIndex === 1) {
          dx = -1; startX = x;    // 西
        } else if (dirIndex === 2) {
          dz = 1; startZ = z + 1; // 南
        } else {
          dz = -1; startZ = z;    // 北
        }

        const otherAxisRand = random(startX, y + h, startZ);
        if (dx !== 0) {
          startZ = Math.abs(otherAxisRand) < 0.5 ? z : z + 1;
        } else {
          startX = Math.abs(otherAxisRand) < 0.5 ? x : x + 1;
        }

        let cx = startX;
        let cy = y + h;
        let cz = startZ;

        const branchLength = 1 + Math.floor(Math.abs(random(cx, cy, cz)) * 2); // 1 或 2

        for (let l = 1; l <= branchLength; l++) {
          cx += dx;
          cz += dz;
          // 有 50% 概率向上爬升一格
          const liftRand = random(cx, cy, cz);
          if (Math.abs(liftRand) < 0.50) {
            cy += 1;
          }

          if (writer.getBlock(cx, cy, cz) === BLOCK_TYPES.AIR) {
            writer.setBlock(cx, cy, cz, block);
            positions.push({ x: cx, y: cy, z: cz });
          }
        }
      }
    }

    return positions;
  }
}
