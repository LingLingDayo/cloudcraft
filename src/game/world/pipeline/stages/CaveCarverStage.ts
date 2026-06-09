import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { BLOCK_TYPES } from '@game/world/BlockConfig';
import { WORLD_CONFIG } from '@game/world/WorldConfig';
import { ImprovedNoise } from '@game/world/Noise';

// 纯噪波的矿洞状态预测，判断在全局坐标 (wx, wy, wz) 处是否应当是洞穴(被挖空为空气)
export function isCaveAt(
  wx: number,
  wy: number,
  wz: number,
  finalHeight: number,
  maxHeightOffset: number,
  localWaterLevel: number,
  noise: ImprovedNoise,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator: any
): boolean {
  if (wy >= WORLD_CONFIG.caves.minHeight && wy <= WORLD_CONFIG.caves.maxHeight && wy <= finalHeight - maxHeightOffset) {
    const warpScale = WORLD_CONFIG.caves.warpScale;
    const warpStrength = WORLD_CONFIG.caves.warpStrength;
    const wxWarped = wx + noise.noise3d(wx * warpScale, wy * warpScale, wz * warpScale) * warpStrength;
    const wyWarped = wy + noise.noise3d(wx * warpScale + 100, wy * warpScale + 100, wz * warpScale + 100) * warpStrength;
    const wzWarped = wz + noise.noise3d(wx * warpScale + 200, wy * warpScale + 200, wz * warpScale + 200) * warpStrength;

    const baseThreshold = WORLD_CONFIG.caves.baseThreshold;
    // 使用极低频 3D 噪波控制局部的粗细变化，形成不规则的“洞室”
    const chamberNoise = noise.noise3d(wx * 0.01, wy * 0.015, wz * 0.01);
    const currentThreshold = baseThreshold + chamberNoise * 0.08;

    const n1 = noise.noise3d(
      wxWarped * WORLD_CONFIG.caves.scaleXZ,
      wyWarped * WORLD_CONFIG.caves.scaleY,
      wzWarped * WORLD_CONFIG.caves.scaleXZ
    );

    // 原始 3D 噪波，用于垂直竖井
    const n2_3d = noise.noise3d(
      wxWarped * WORLD_CONFIG.caves.scaleXZ + 100,
      wyWarped * WORLD_CONFIG.caves.scaleY + 100,
      wzWarped * WORLD_CONFIG.caves.scaleXZ + 100
    );

    // 1. 水平隧道层约束 (Sin 周期，并加低频起伏)
    const layerOffset = noise.noise(wx * WORLD_CONFIG.caves.layerOffsetScale, wz * WORLD_CONFIG.caves.layerOffsetScale) * WORLD_CONFIG.caves.layerOffsetStrength;
    const sinArg = (wyWarped + layerOffset) * Math.PI / WORLD_CONFIG.caves.layerSpacing;
    const n2_dist = Math.sin(sinArg) * WORLD_CONFIG.caves.verticalScale;

    // 2. 垂直/大倾斜竖井噪波与混合因子
    const shaftNoise = noise.noise3d(
      wxWarped * WORLD_CONFIG.caves.shaftNoiseScale,
      wyWarped * WORLD_CONFIG.caves.shaftNoiseScale,
      wzWarped * WORLD_CONFIG.caves.shaftNoiseScale
    );
    const blend = Math.max(0, Math.min(1, (shaftNoise - WORLD_CONFIG.caves.shaftThreshold) / WORLD_CONFIG.caves.shaftBlendRange));

    // 3. 混合水平隧道与垂直竖井
    const n2 = (1.0 - blend) * n2_dist + blend * n2_3d;

    // 圆周判定：n1*n1 + n2*n2 < currentThreshold*currentThreshold
    if (n1 * n1 + n2 * n2 < currentThreshold * currentThreshold) {
      // 检查是否靠近 any water域（当 wy <= localWaterLevel 时），防止矿洞从侧面穿透水体
      let adjacentToWater = false;
      if (wy <= localWaterLevel) {
        const neighbors = [
          [wx + 1, wz],
          [wx - 1, wz],
          [wx, wz + 1],
          [wx, wz - 1]
        ];
        for (const [nx, nz] of neighbors) {
          if (generator.isWaterArea(nx, nz)) {
            adjacentToWater = true;
            break;
          }
        }
      }
      return !adjacentToWater;
    }
  }
  return false;
}

export class CaveCarverStage implements ChunkPipelineStage {
  public name = 'CaveCarver';

  public execute(context: ChunkPipelineContext): void {
    const { chunk, terrainMap, worldStartY, noise, worldStartX, worldStartZ, generator } = context;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const col = terrainMap[x][z];
        const wx = worldStartX + x;
        const wz = worldStartZ + z;

        for (let ly = 0; ly < 16; ly++) {
          const y = worldStartY + ly;
          const index = x + z * 16 + ly * 256;

          if (isCaveAt(wx, y, wz, col.finalHeight, col.maxHeightOffset, col.localWaterLevel, noise, generator)) {
            chunk[index] = BLOCK_TYPES.AIR;
          }
        }
      }
    }
  }
}
