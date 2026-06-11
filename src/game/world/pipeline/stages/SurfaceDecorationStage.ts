import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { BLOCK_TYPES, getBlockProperties, canBlockGrowOn } from '@game/world/BlockConfig';
import { isCaveAt } from './CaveCarverStage';
export { isCaveAt };

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
                wz,
                col.slope
              );
              const groundProps = getBlockProperties(groundType);
              if (groundProps.allowVegetationBase) {
                // 如果是沙子，且不是沙漠生态，则不允许在该沙子上生成任何地表植被/枯木/枯花等
                if (groundType === BLOCK_TYPES.SAND && biome.id !== 'desert') {
                  chunk[index] = BLOCK_TYPES.AIR;
                  continue;
                }

                const vegType = biome.getVegetationType(wx, wz, noise);
                if (vegType !== BLOCK_TYPES.AIR && canBlockGrowOn(vegType, groundType)) {
                  chunk[index] = vegType;
                } else {
                  chunk[index] = BLOCK_TYPES.AIR;
                }
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
