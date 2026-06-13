import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { BLOCK_TYPES } from '@game/world/BlockConfig';
import { OreRegistry } from '@game/world/ore/OreRegistry';

/**
 * 管道流水线阶段：矿物生成器阶段。
 * 本阶段扫描整个 Sub-chunk 的填充结果，将基底的普通石头依据策略替换为煤矿、铁矿或钻石矿。
 */
export class OreGeneratorStage implements ChunkPipelineStage {
  public name = 'OreGenerator';

  public execute(context: ChunkPipelineContext): void {
    const { chunk, worldStartX, worldStartY, worldStartZ, noise, biomeMap } = context;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const biome = biomeMap[x][z];
        const wx = worldStartX + x;
        const wz = worldStartZ + z;

        for (let ly = 0; ly < 16; ly++) {
          const y = worldStartY + ly;
          const index = x + z * 16 + ly * 256;

          // 仅替换已经是 STONE 的方块，并且保留世界最底层的基底（y = 0）为基础石头，不生成矿物
          if (chunk[index * 2] === BLOCK_TYPES.STONE && y > 0) {
            const block = OreRegistry.generateOre(wx, y, wz, noise, biome.id);
            if (block !== BLOCK_TYPES.STONE) {
              chunk[index * 2] = block;
            }
          }
        }
      }
    }
  }
}
