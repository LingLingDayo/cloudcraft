import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { BLOCK_TYPES } from '@game/world/BlockConfig';

export class BaseTerrainFillerStage implements ChunkPipelineStage {
  public name = 'BaseTerrainFiller';

  public execute(context: ChunkPipelineContext): void {
    const { chunk, terrainMap, biomeMap, worldStartY, noise, worldStartX, worldStartZ } = context;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const col = terrainMap[x][z];
        const biome = biomeMap[x][z];
        const wx = worldStartX + x;
        const wz = worldStartZ + z;

        for (let ly = 0; ly < 16; ly++) {
          const y = worldStartY + ly;
          const index = x + z * 16 + ly * 256;

          if (y === 0) {
            chunk[index] = BLOCK_TYPES.STONE;
          } else if (y <= col.finalHeight) {
            const depth = col.finalHeight - y + 1;
            biome.fillColumn(
              chunk,
              x,
              z,
              y,
              col.finalHeight,
              col.localWaterLevel,
              depth,
              noise,
              wx,
              wz,
              col.isDryLand && !col.isPond
            );
          } else if (y <= col.localWaterLevel && (!col.isDryLand || col.isPond)) {
            chunk[index] = BLOCK_TYPES.WATER;
          } else {
            chunk[index] = BLOCK_TYPES.AIR;
          }
        }
      }
    }
  }
}
