import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';

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

          const indexDouble = index * 2;
          if (y === 0) {
            chunk[indexDouble] = BLOCK_TYPES.STONE;
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
              col.isDryLand && !col.isPond,
              col.slope
            );
          } else if (y <= col.localWaterLevel && (!col.isDryLand || col.isPond)) {
            chunk[indexDouble] = BLOCK_TYPES.WATER;
          } else {
            chunk[indexDouble] = BLOCK_TYPES.AIR;
          }

          // Initialize Light values (Sky Light and Block Light)
          const blockType = chunk[indexDouble];
          let skyLight = 15;
          if (y < col.finalHeight) {
            skyLight = Math.max(0, 15 - (col.finalHeight - y) * 2);
          }
          if (blockType === BLOCK_TYPES.WATER && y < col.localWaterLevel) {
            const depthInWater = col.localWaterLevel - y;
            skyLight = Math.max(0, skyLight - depthInWater * 2);
          }
          let blockLight = 0;
          try {
            const props = getBlockProperties(blockType);
            if (props && props.lightLevel > 0) {
              blockLight = props.lightLevel;
            }
          } catch (_e) {
            // Fail-safe for tests where resolver is not initialized
          }
          chunk[indexDouble + 1] = (skyLight << 4) | blockLight;
        }
      }
    }
  }
}
