import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';
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
  if (wy >= WORLD_CONFIG.caves.minHeight && wy <= finalHeight - maxHeightOffset) {
    const warpScale = WORLD_CONFIG.caves.warpScale;
    const warpStrength = WORLD_CONFIG.caves.warpStrength;
    const wxWarped = wx + noise.noise3d(wx * warpScale, wy * warpScale, wz * warpScale) * warpStrength;
    const wyWarped = wy + noise.noise3d(wx * warpScale + 100, wy * warpScale + 100, wz * warpScale + 100) * warpStrength;
    const wzWarped = wz + noise.noise3d(wx * warpScale + 200, wy * warpScale + 200, wz * warpScale + 200) * warpStrength;

    const baseThreshold = WORLD_CONFIG.caves.baseThreshold;
    const chamberNoise = noise.noise3d(wx * 0.01, wy * 0.015, wz * 0.01);
    const currentThreshold = baseThreshold + chamberNoise * 0.08;

    const n1 = noise.noise3d(
      wxWarped * WORLD_CONFIG.caves.scaleXZ,
      wyWarped * WORLD_CONFIG.caves.scaleY,
      wzWarped * WORLD_CONFIG.caves.scaleXZ
    );
    const n2 = noise.noise3d(
      wxWarped * WORLD_CONFIG.caves.scaleXZ + 100,
      wyWarped * WORLD_CONFIG.caves.scaleY + 100,
      wzWarped * WORLD_CONFIG.caves.scaleXZ + 100
    );

    if (n1 * n1 + n2 * n2 < currentThreshold * currentThreshold) {
      let adjacentToWater = false;
      if (wy <= localWaterLevel) {
        const neighbors = [
          [wx + 1, wz], [wx - 1, wz],
          [wx, wz + 1], [wx, wz - 1]
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

export class SurfaceDecorationStage implements ChunkPipelineStage {
  public name = 'SurfaceDecoration';

  public execute(context: ChunkPipelineContext): void {
    const { chunk, terrainMap, biomeMap, worldStartY, noise, worldStartX, worldStartZ, generator } = context;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const col = terrainMap[x][z];
        const biome = biomeMap[x][z];
        const wx = worldStartX + x;
        const wz = worldStartZ + z;

        for (let ly = 0; ly < 16; ly++) {
          const y = worldStartY + ly;
          const index = x + z * 16 + ly * 256;

          if (y === col.finalHeight + 1 && col.localWaterLevel <= col.finalHeight) {
            // 检测地表支撑物是否安全
            const groundY = col.finalHeight;
            let isGroundSecure: boolean;
            
            if (groundY >= worldStartY && groundY < worldStartY + 16) {
              // 地表格就在当前 sub-chunk 中，直接读取实际方块状态
              const groundIdx = x + z * 16 + (groundY - worldStartY) * 256;
              const actualGround = chunk[groundIdx];
              isGroundSecure = actualGround !== BLOCK_TYPES.AIR && actualGround !== BLOCK_TYPES.WATER;
            } else {
              // 地表格在下方 sub-chunk 中，需要通过 isCaveAt 预测
              const isCarved = isCaveAt(wx, groundY, wz, col.finalHeight, col.maxHeightOffset, col.localWaterLevel, noise, generator);
              isGroundSecure = !isCarved;
            }

            if (isGroundSecure) {
              const groundType = generator.getGroundBlockType(
                biome,
                col.finalHeight,
                col.localWaterLevel,
                col.isDryLand && !col.isPond,
                wx,
                wz
              );
              const groundProps = getBlockProperties(groundType);
              if (groundProps.allowVegetationBase) {
                chunk[index] = biome.getVegetationType(wx, wz, noise);
              } else {
                chunk[index] = BLOCK_TYPES.AIR;
              }
            } else {
              // 地表已被洞穴掏空，严禁放置植被，填充为空气
              chunk[index] = BLOCK_TYPES.AIR;
            }
          } else if (y === col.finalHeight + 2 && col.localWaterLevel <= col.finalHeight) {
            // 双格高的植物顶部块需要同样的安全依赖
            const groundY = col.finalHeight;
            let isGroundSecure: boolean;
            if (groundY >= worldStartY && groundY < worldStartY + 16) {
              const groundIdx = x + z * 16 + (groundY - worldStartY) * 256;
              const actualGround = chunk[groundIdx];
              isGroundSecure = actualGround !== BLOCK_TYPES.AIR && actualGround !== BLOCK_TYPES.WATER;
            } else {
              const isCarved = isCaveAt(wx, groundY, wz, col.finalHeight, col.maxHeightOffset, col.localWaterLevel, noise, generator);
              isGroundSecure = !isCarved;
            }

            if (isGroundSecure) {
              // 双格植物下半部分必须还在
              const bottomIdx = x + z * 16 + ((col.finalHeight + 1 - worldStartY) % 16) * 256;
              const belowType = chunk[bottomIdx];
              if (belowType === BLOCK_TYPES.SUNFLOWER_BOTTOM) {
                chunk[index] = BLOCK_TYPES.SUNFLOWER_TOP;
              } else if (belowType === BLOCK_TYPES.ROSE_BUSH_BOTTOM) {
                chunk[index] = BLOCK_TYPES.ROSE_BUSH_TOP;
              } else if (belowType === BLOCK_TYPES.PEONY_BOTTOM) {
                chunk[index] = BLOCK_TYPES.PEONY_TOP;
              } else if (belowType === BLOCK_TYPES.LILAC_BOTTOM) {
                chunk[index] = BLOCK_TYPES.LILAC_TOP;
              } else if (belowType === BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM) {
                chunk[index] = BLOCK_TYPES.DOUBLE_TALL_GRASS_TOP;
              } else {
                chunk[index] = BLOCK_TYPES.AIR;
              }
            } else {
              chunk[index] = BLOCK_TYPES.AIR;
            }
          }
        }
      }
    }
  }
}
