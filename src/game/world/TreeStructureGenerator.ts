import { TreeStyle } from './biome/Biome';
import { BLOCK_TYPES } from './BlockConfig';

/**
 * BlockWriter 接口：解耦具体物理/网络/内存等世界修改后端
 */
export interface BlockWriter {
  setBlock(x: number, y: number, z: number, type: number): void;
  getBlock(x: number, y: number, z: number): number;
}

/**
 * 局部 Chunk BlockWriter 适配器
 */
export class ChunkBlockWriter implements BlockWriter {
  private chunk: Uint8Array;
  private startX: number;
  private startY: number;
  private startZ: number;

  constructor(
    chunk: Uint8Array,
    startX: number,
    startY: number,
    startZ: number
  ) {
    this.chunk = chunk;
    this.startX = startX;
    this.startY = startY;
    this.startZ = startZ;
  }

  public setBlock(x: number, y: number, z: number, type: number): void {
    const lcx = x - this.startX;
    const lcy = y - this.startY;
    const lcz = z - this.startZ;
    if (
      lcx >= 0 && lcx < 16 &&
      lcy >= 0 && lcy < 16 &&
      lcz >= 0 && lcz < 16
    ) {
      const idx = lcx + lcz * 16 + lcy * 256;
      this.chunk[idx] = type;
    }
  }

  public getBlock(x: number, y: number, z: number): number {
    const lcx = x - this.startX;
    const lcy = y - this.startY;
    const lcz = z - this.startZ;
    if (
      lcx >= 0 && lcx < 16 &&
      lcy >= 0 && lcy < 16 &&
      lcz >= 0 && lcz < 16
    ) {
      const idx = lcx + lcz * 16 + lcy * 256;
      return this.chunk[idx];
    }
    return BLOCK_TYPES.AIR;
  }
}

/**
 * 游戏 World BlockWriter 适配器
 */
export class WorldBlockWriter implements BlockWriter {
  private world: {
    setBlock(x: number, y: number, z: number, type: number): void;
    getBlock(x: number, y: number, z: number): number;
  };

  constructor(
    world: {
      setBlock(x: number, y: number, z: number, type: number): void;
      getBlock(x: number, y: number, z: number): number;
    }
  ) {
    this.world = world;
  }

  public setBlock(x: number, y: number, z: number, type: number): void {
    this.world.setBlock(x, y, z, type);
  }

  public getBlock(x: number, y: number, z: number): number {
    return this.world.getBlock(x, y, z);
  }
}

/**
 * 内存 Map BlockWriter 适配器（用于测试和干燥环境）
 */
export class MemoryBlockWriter implements BlockWriter {
  private blocks = new Map<string, number>();

  public setBlock(x: number, y: number, z: number, type: number): void {
    this.blocks.set(`${x},${y},${z}`, type);
  }

  public getBlock(x: number, y: number, z: number): number {
    return this.blocks.get(`${x},${y},${z}`) ?? BLOCK_TYPES.AIR;
  }

  public getBlocks(): Map<string, number> {
    return this.blocks;
  }
}

export type RandomProvider = (x: number, y: number, z: number) => number;

/**
 * 统一的树木与大型植物三维网格结构生成器
 */
export class TreeStructureGenerator {
  /**
   * 通用树木生长核心算法
   */
  public static growTree(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    trunkBlock: number,
    leafBlock: number,
    height: number,
    style: TreeStyle,
    randomProvider: RandomProvider
  ): void {
    // 只有当树干放置的地基存在时，才把草地/地基变为泥土
    writer.setBlock(x, y, z, BLOCK_TYPES.DIRT);

    // 仙人掌特殊生成
    if (style === ('cactus' as unknown as TreeStyle)) {
      for (let h = 1; h <= height; h++) {
        writer.setBlock(x, y + h, z, trunkBlock);
      }
      return;
    }

    // 生成树干
    for (let h = 1; h <= height; h++) {
      writer.setBlock(x, y + h, z, trunkBlock);
    }

    const leafCenterY = y + height + 1;

    if (style === TreeStyle.OAK || style === TreeStyle.BIRCH) {
      const startY = style === TreeStyle.BIRCH ? -3 : -2;
      for (let ly = startY; ly <= 1; ly++) {
        const radius = ly === 1 ? 1 : 2;
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (lx === 0 && lz === 0 && ly <= 0) continue;

            if (style === TreeStyle.BIRCH && ly === startY && Math.abs(lx) === radius && Math.abs(lz) === radius) {
              continue;
            }

            const wlx = x + lx;
            const wlz = z + lz;
            const wly = leafCenterY + ly;

            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              const leafRand = randomProvider(wlx, wly, wlz);
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
    } else if (style === TreeStyle.SPRUCE) {
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

            if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
              continue;
            }

            const wlx = x + lx;
            const wlz = z + lz;
            const wly = leafCenterY + ly;

            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              const leafRand = randomProvider(wlx, wly, wlz);
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
    } else if (style === TreeStyle.JUNGLE) {
      for (let ly = -3; ly <= 1; ly++) {
        const radius = ly === 1 ? 1 : (ly === -3 ? 1 : 2);
        for (let lx = -radius; lx <= radius; lx++) {
          for (let lz = -radius; lz <= radius; lz++) {
            if (lx === 0 && lz === 0 && ly <= 0) continue;

            if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
              continue;
            }

            const wlx = x + lx;
            const wlz = z + lz;
            const wly = leafCenterY + ly;

            const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
            if (isOuter && !(lx === 0 && lz === 0)) {
              const leafRand = randomProvider(wlx, wly, wlz);
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
    }
  }
}
