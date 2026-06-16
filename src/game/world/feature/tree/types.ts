import type { BlockWriter, RandomProvider } from '../../TreeStructureGenerator';

/**
 * 代表三维空间中的方块位置
 */
export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

/**
 * 树干生成策略接口 (TrunkPlacer)
 * // Extension Point: 如果需要生成其他样式的树干，可以实现该接口。
 */
export interface TrunkPlacer {
  readonly type: string;
  place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    random: RandomProvider,
    dirtBlock?: number
  ): BlockPos[];
}

/**
 * 树冠/树叶生成策略接口 (FoliagePlacer)
 * // Extension Point: 如果需要定制特别形状 of 树冠，可以实现该接口。
 */
export interface FoliagePlacer {
  readonly type: string;
  place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    trunkPositions: BlockPos[],
    random: RandomProvider
  ): void;
}

/**
 * 树木生成的配置对象，解耦方块类型与算法配置
 */
export interface TreeConfig {
  trunkBlock: number;
  leafBlock: number;
  minHeight: number;
  heightVariance: number;
  trunkPlacer: TrunkPlacer;
  foliagePlacer: FoliagePlacer;
  dirtBlock?: number; // 默认为泥土，允许不同树木定义特殊地基
}
