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
