import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { BLOCK_TYPES } from '../../BlockConfig';
import { WORLD_CONFIG } from '../../WorldConfig';

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

          // 矿洞仅在 minHeight 以上、地表下限制格以下生成
          if (y >= WORLD_CONFIG.caves.minHeight && y <= col.finalHeight - col.maxHeightOffset) {
            const warpScale = WORLD_CONFIG.caves.warpScale;
            const warpStrength = WORLD_CONFIG.caves.warpStrength;
            const wxWarped = wx + noise.noise3d(wx * warpScale, y * warpScale, wz * warpScale) * warpStrength;
            const yWarped = y + noise.noise3d(wx * warpScale + 100, y * warpScale + 100, wz * warpScale + 100) * warpStrength;
            const wzWarped = wz + noise.noise3d(wx * warpScale + 200, y * warpScale + 200, wz * warpScale + 200) * warpStrength;

            const baseThreshold = WORLD_CONFIG.caves.baseThreshold;
            // 使用极低频 3D 噪波控制局部的粗细变化，形成不规则的“洞室”
            const chamberNoise = noise.noise3d(wx * 0.01, y * 0.015, wz * 0.01);
            const currentThreshold = baseThreshold + chamberNoise * 0.08;

            const n1 = noise.noise3d(
              wxWarped * WORLD_CONFIG.caves.scaleXZ,
              yWarped * WORLD_CONFIG.caves.scaleY,
              wzWarped * WORLD_CONFIG.caves.scaleXZ
            );
            const n2 = noise.noise3d(
              wxWarped * WORLD_CONFIG.caves.scaleXZ + 100,
              yWarped * WORLD_CONFIG.caves.scaleY + 100,
              wzWarped * WORLD_CONFIG.caves.scaleXZ + 100
            );

            // 圆周判定：n1*n1 + n2*n2 < currentThreshold*currentThreshold
            if (n1 * n1 + n2 * n2 < currentThreshold * currentThreshold) {
              // 检查是否靠近 any water域（当 y <= localWaterLevel 时），防止矿洞从侧面穿透水体
              let adjacentToWater = false;
              if (y <= col.localWaterLevel) {
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

              if (!adjacentToWater) {
                // 雕刻为空气 (Caves are filled with air)
                chunk[index] = BLOCK_TYPES.AIR;
              }
            }
          }
        }
      }
    }
  }
}
