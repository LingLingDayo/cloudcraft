import { ImprovedNoise } from './Noise';
import { WORLD_CONFIG } from './WorldConfig';

export interface ConnectionContext {
  noise: ImprovedNoise;
  waterLevel: number;
  oceanThreshold: number;
  maxDepth: number;
}

export class WaterConnectionSolver {
  /**
   * 使用 BFS 检测指定起点在低于水面的地势下是否能与天然大水体（海洋、河流等）连通。
   * 采用局部探查，遇到高度不低于水面的地形会自动剪枝（即遇到高度齐平或更高的地形阻挡）。
   *
   * @param startX 起点 X 世界坐标
   * @param startZ 起点 Z 世界坐标
   * @param ctx 连通性配置上下文
   * @param getRawHeight 获取任意全局坐标的原始高度噪波值的委托
   * @param getRiverWeight 获取任意全局坐标的河流权重值的委托
   */
  public static isConnectedToNaturalWater(
    startX: number,
    startZ: number,
    ctx: ConnectionContext,
    getRawHeight: (x: number, z: number) => number,
    getRiverWeight: (x: number, z: number) => number
  ): boolean {
    const queue: [number, number, number][] = []; // [wx, wz, depth]
    const visited = new Set<string>();

    queue.push([startX, startZ, 0]);
    visited.add(`${startX},${startZ}`);

    while (queue.length > 0) {
      const [cx, cz, depth] = queue.shift()!;

      // 1. 判定当前位置是否原本就是天然海洋
      const scale = WORLD_CONFIG.landform.scale;
      const c = (ctx.noise.noise(
        (cx + WORLD_CONFIG.landform.offsetC) * scale,
        (cz + WORLD_CONFIG.landform.offsetC) * scale
      ) + 1) / 2;

      if (c < ctx.oceanThreshold) {
        return true;
      }

      // 2. 判定当前位置是否是天然河流
      if (getRiverWeight(cx, cz) > 0.35) {
        return true;
      }

      // 达到最大步数限制，继续判断更深层则可能引起性能损耗，在此处截断
      if (depth >= ctx.maxDepth) {
        continue;
      }

      // 3. 向相邻 4 邻域扩散判断
      const neighbors = [
        [cx + 1, cz],
        [cx - 1, cz],
        [cx, cz + 1],
        [cx, cz - 1]
      ];

      for (const [nx, nz] of neighbors) {
        const key = `${nx},${nz}`;
        if (visited.has(key)) {
          continue;
        }

        const h = getRawHeight(nx, nz);
        // 核心物理剪枝：只有当相邻的格子原始高度低于海平面时，水才能顺着流过来
        if (h < ctx.waterLevel) {
          visited.add(key);
          queue.push([nx, nz, depth + 1]);
        }
      }
    }

    return false;
  }
}
