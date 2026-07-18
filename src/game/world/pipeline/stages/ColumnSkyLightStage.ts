import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';
import { WORLD_HEIGHT } from '@game/world/ChunkMeshBuilder';

const CHUNK_SIZE = 16;

const LEAF_TYPES = new Set<number>([
  BLOCK_TYPES.LEAF,
  BLOCK_TYPES.BIRCH_LEAVES,
  BLOCK_TYPES.SPRUCE_LEAVES,
  BLOCK_TYPES.JUNGLE_LEAVES,
]);

/**
 * Final sky-light pass after caves / surface / trees rewrite voxels.
 *
 * BaseTerrainFiller only seeds an approximate column light from heightmap.
 * Without this stage, cave air keeps "buried rock" light and tree edits only
 * touch their own cells — baked mesh light then disagrees across chunk seams
 * until a player edit runs World.recalculateColumnSkyLight.
 *
 * Attenuation rules match World.recalculateColumnSkyLight so generation and
 * runtime edits converge on the same packed sky nibbles.
 */
export class ColumnSkyLightStage implements ChunkPipelineStage {
  public name = 'ColumnSkyLight';

  public execute(context: ChunkPipelineContext): void {
    const { chunk, terrainMap, worldStartY } = context;
    const chunkTopY = worldStartY + CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const col = terrainMap[x][z];
        let skyLight = this.estimateIncomingSkyLight(
          col.finalHeight,
          col.localWaterLevel,
          col.isDryLand && !col.isPond,
          chunkTopY,
        );

        for (let ly = CHUNK_SIZE - 1; ly >= 0; ly--) {
          const index = x + z * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE;
          const indexDouble = index * 2;
          const blockType = chunk[indexDouble] & 0x3f;

          let isTransparent = blockType === BLOCK_TYPES.AIR;
          if (!isTransparent) {
            try {
              isTransparent = getBlockProperties(blockType).isTransparent;
            } catch {
              isTransparent = false;
            }
          }

          if (!isTransparent) {
            skyLight = Math.max(0, skyLight - 3);
          } else if (LEAF_TYPES.has(blockType)) {
            skyLight = Math.max(0, skyLight - 1);
          }

          const oldPacked = chunk[indexDouble + 1];
          const blockLight = oldPacked & 0x0f;
          chunk[indexDouble + 1] = (skyLight << 4) | blockLight;
        }
      }
    }
  }

  /**
   * Sky light entering the top face of this sub-chunk (y = chunkTopY).
   * Higher sub-chunks are not in memory during generation, so we approximate
   * attenuation with the column heightmap (and standing water) only.
   */
  private estimateIncomingSkyLight(
    finalHeight: number,
    localWaterLevel: number,
    isLandSurface: boolean,
    chunkTopY: number,
  ): number {
    if (chunkTopY >= WORLD_HEIGHT) {
      return 15;
    }

    let skyLight = 15;
    for (let y = WORLD_HEIGHT - 1; y >= chunkTopY; y--) {
      if (y <= finalHeight) {
        // Solid terrain column above this sub-chunk.
        skyLight = Math.max(0, skyLight - 3);
      } else if (!isLandSurface && y <= localWaterLevel) {
        // Standing water column — treat like a mild occluder (matches filler intent).
        skyLight = Math.max(0, skyLight - 1);
      }
      // else open air: no attenuation
    }
    return skyLight;
  }
}
