import type { WorldFeature } from './WorldFeature';
import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';

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
 * // Extension Point: 如果需要定制特别形状的树冠，可以实现该接口。
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

/**
 * 公共辅助函数：在主干范围外的侧枝节点周围放置微型圆球状树叶簇
 * @param trunkWidth 1 表示 1x1 树干，2 表示 2x2 树干
 */
function placeBranchLeaves(
  writer: BlockWriter,
  x: number,
  z: number,
  trunkPositions: BlockPos[],
  block: number,
  trunkWidth: 1 | 2
): void {
  const isMainTrunk = (px: number, pz: number): boolean => {
    if (trunkWidth === 1) {
      return px === x && pz === z;
    } else {
      return px >= x && px <= x + 1 && pz >= z && pz <= z + 1;
    }
  };

  const branchPositions = trunkPositions.filter(
    (pos) => !isMainTrunk(pos.x, pos.z)
  );

  for (const branch of branchPositions) {
    // 侧枝叶簇：在每个侧枝节点周围生成一个微型圆球树叶簇 (dy 从 -1 到 1)
    for (let dy = -1; dy <= 1; dy++) {
      const radius = dy === 1 ? 0 : 1; // 顶层半径为 0，其它层为 1
      const minX = -radius;
      const maxX = radius;
      const minZ = -radius;
      const maxZ = radius;

      for (let dx = minX; dx <= maxX; dx++) {
        for (let dz = minZ; dz <= maxZ; dz++) {
          // 仅当半径为 1 时过滤角落，形成圆形
          if (radius > 0 && Math.abs(dx) === radius && Math.abs(dz) === radius) {
            continue;
          }

          const wlx = branch.x + dx;
          const wly = branch.y + dy;
          const wlz = branch.z + dz;

          if (writer.getBlock(wlx, wly, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, wly, wlz, block);
          }
        }
      }
    }
  }
}

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

/**
 * 球形/柱状通用树冠放置器 (BlobFoliagePlacer)
 * 适用于橡树、桦树、丛林树等标准树叶簇
 */
export class BlobFoliagePlacer implements FoliagePlacer {
  public readonly type = 'blob';

  private readonly config: {
    minLy: number;
    maxLy: number;
    radiusProvider: (ly: number) => number;
    excludeCornersLayers?: number[];
    discardChance?: number;
  };

  constructor(
    config: {
      minLy: number;
      maxLy: number;
      radiusProvider: (ly: number) => number;
      excludeCornersLayers?: number[];
      discardChance?: number;
    }
  ) {
    this.config = config;
  }

  public place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    trunkPositions: BlockPos[],
    random: RandomProvider
  ): void {
    const leafCenterY = y + height + 1;
    const {
      minLy,
      maxLy,
      radiusProvider,
      excludeCornersLayers = [],
      discardChance = 0
    } = this.config;

    // 1. 生成树顶主树冠
    for (let ly = minLy; ly <= maxLy; ly++) {
      const radius = radiusProvider(ly);
      if (radius <= 0) continue;

      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          // 树干中低部（ly <= 0 且在中心）不覆盖树叶
          if (lx === 0 && lz === 0 && ly <= 0) continue;

          // 剔除指定层数的角落位置
          const isCorner = Math.abs(lx) === radius && Math.abs(lz) === radius;
          if (isCorner && excludeCornersLayers.includes(ly)) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;
          const wly = leafCenterY + ly;

          // 外侧边缘树叶随机不生成 (模拟自然破损风格)
          const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
          if (isOuter && !(lx === 0 && lz === 0) && discardChance > 0) {
            const leafRand = random(wlx, wly, wlz);
            if (leafRand < discardChance) {
              continue;
            }
          }

          if (writer.getBlock(wlx, wly, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, wly, wlz, block);
          }
        }
      }
    }

    // 2. 为侧枝生成小叶簇
    placeBranchLeaves(writer, x, z, trunkPositions, block, 1);
  }
}

/**
 * 云杉专用的塔状松针树冠放置器 (SpruceFoliagePlacer)
 */
export class SpruceFoliagePlacer implements FoliagePlacer {
  public readonly type = 'spruce';

  public place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    _trunkPositions: BlockPos[],
    random: RandomProvider
  ): void {
    const leafCenterY = y + height + 1;

    for (let ly = -4; ly <= 1; ly++) {
      let radius = 1;
      if (ly === 1) radius = 0;
      else if (ly === 0) radius = 1;
      else if (ly === -1) radius = 2;
      else if (ly === -2) radius = 1;
      else if (ly === -3) radius = 2;
      else if (ly === -4) radius = 2;

      if (radius <= 0) continue;

      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly <= 0) continue;

          // 半径为 2 时，剔除 4 个角落
          if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;
          const wly = leafCenterY + ly;

          // 外层叶子随机剔除
          const isOuter = radius > 0 && (Math.abs(lx) === radius || Math.abs(lz) === radius);
          if (isOuter && !(lx === 0 && lz === 0)) {
            const leafRand = random(wlx, wly, wlz);
            if (leafRand < 0.20) {
              continue;
            }
          }

          if (writer.getBlock(wlx, wly, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, wly, wlz, block);
          }
        }
      }
    }
  }
}

/**
 * 2x2 巨型丛林树冠放置器 (MegaJungleFoliagePlacer)
 * 围绕 2x2 树冠生成宽大叶冠，并在侧枝末梢挂载小十字叶簇
 */
export class MegaJungleFoliagePlacer implements FoliagePlacer {
  public readonly type = 'mega_jungle';

  private readonly config: {
    minLy: number;
    maxLy: number;
    radiusProvider: (ly: number) => number;
    excludeCornersLayers?: number[];
    discardChance?: number;
  };

  constructor(
    config: {
      minLy: number;
      maxLy: number;
      radiusProvider: (ly: number) => number;
      excludeCornersLayers?: number[];
      discardChance?: number;
    }
  ) {
    this.config = config;
  }

  public place(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    height: number,
    block: number,
    trunkPositions: BlockPos[],
    random: RandomProvider
  ): void {
    const leafCenterY = y + height + 1;
    const {
      minLy,
      maxLy,
      radiusProvider,
      excludeCornersLayers = [],
      discardChance = 0
    } = this.config;

    // 1. 生成顶端巨型 2x2 对称主树冠
    for (let ly = minLy; ly <= maxLy; ly++) {
      const radius = radiusProvider(ly);
      if (radius <= 0) continue;

      const minX = -radius;
      const maxX = 1 + radius;
      const minZ = -radius;
      const maxZ = 1 + radius;

      for (let lx = minX; lx <= maxX; lx++) {
        for (let lz = minZ; lz <= maxZ; lz++) {
          const inTrunk = lx >= 0 && lx <= 1 && lz >= 0 && lz <= 1;
          if (inTrunk && ly <= 0) continue;

          // 剔除 2x2 四周边角的叶子
          const isCorner = (lx === minX || lx === maxX) && (lz === minZ || lz === maxZ);
          if (isCorner && excludeCornersLayers.includes(ly)) {
            continue;
          }

          const wlx = x + lx;
          const wlz = z + lz;
          const wly = leafCenterY + ly;

          const isOuter = lx === minX || lx === maxX || lz === minZ || lz === maxZ;
          if (isOuter && !inTrunk && discardChance > 0) {
            const leafRand = random(wlx, wly, wlz);
            if (leafRand < discardChance) {
              continue;
            }
          }

          if (writer.getBlock(wlx, wly, wlz) === BLOCK_TYPES.AIR) {
            writer.setBlock(wlx, wly, wlz, block);
          }
        }
      }
    }

    // 2. 为侧枝生成十字小叶簇
    placeBranchLeaves(writer, x, z, trunkPositions, block, 2);
  }
}

/**
 * 通用树特征类 (GenericTreeFeature)
 * // Extension Point: 新型树种只需要提供对应的 TreeConfig
 */
export class GenericTreeFeature implements WorldFeature {
  public readonly id: string;
  protected readonly config: TreeConfig;

  constructor(
    id: string,
    config: TreeConfig
  ) {
    this.id = id;
    this.config = config;
  }

  public generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean {
    const dirt = this.config.dirtBlock ?? BLOCK_TYPES.DIRT;

    // 随机计算高度
    const heightRand = random(x, y, z);
    const treeHeight =
      this.config.minHeight +
      Math.floor(Math.abs(heightRand) * this.config.heightVariance);

    // 放置树干并铺设地基
    const trunkPositions = this.config.trunkPlacer.place(
      writer,
      x,
      y,
      z,
      treeHeight,
      this.config.trunkBlock,
      random,
      dirt
    );

    // 放置树冠
    this.config.foliagePlacer.place(
      writer,
      x,
      y,
      z,
      treeHeight,
      this.config.leafBlock,
      trunkPositions,
      random
    );

    return true;
  }
}
