import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { WORLD_CONFIG } from '@game/world/WorldConfig';
import { WORLD_HEIGHT } from '@game/world/World';

export class TerrainHeightMapStage implements ChunkPipelineStage {
  public name = 'TerrainHeightMap';

  public execute(context: ChunkPipelineContext): void {
    const { worldStartX, worldStartZ, generator, noise } = context;
    
    // Initialize 16x16 maps
    context.terrainMap = [];
    context.biomeMap = [];
    
    for (let x = 0; x < 16; x++) {
      context.terrainMap[x] = [];
      context.biomeMap[x] = [];
      
      for (let z = 0; z < 16; z++) {
        const wx = worldStartX + x;
        const wz = worldStartZ + z;
        
        const { height: interpolatedHeight, primaryBiome } = generator.getInterpolatedHeightAndBiome(wx, wz);
        context.biomeMap[x][z] = primaryBiome;
        
        const oceanNoise = noise.noise(wx * WORLD_CONFIG.ocean.scale, wz * WORLD_CONFIG.ocean.scale);
        const waterLevel = WORLD_CONFIG.waterLevel;
        
        let adjustedHeight = interpolatedHeight;
        let isDryLand = true;

        if (oceanNoise < WORLD_CONFIG.ocean.threshold) {
          isDryLand = false;
          const oceanFactor = Math.min(1, (WORLD_CONFIG.ocean.threshold - oceanNoise) / WORLD_CONFIG.ocean.transitionWidth);
          const oceanBaseHeight = WORLD_CONFIG.ocean.baseHeight + noise.noise(wx * 0.02, wz * 0.02) * 3;
          adjustedHeight = Math.round((1 - oceanFactor) * interpolatedHeight + oceanFactor * oceanBaseHeight);
        } else {
          const distToShore = oceanNoise - WORLD_CONFIG.ocean.threshold;
          if (distToShore < WORLD_CONFIG.ocean.shoreWidth) {
            const t = distToShore / WORLD_CONFIG.ocean.shoreWidth;
            const minShoreHeight = waterLevel + 1;
            if (adjustedHeight < minShoreHeight) {
              adjustedHeight = Math.round(t * adjustedHeight + (1 - t) * minShoreHeight);
            }
          }
        }

        const { t: riverT, bedHeight: riverBedHeight, dRiver } = generator.getRiverValue(wx, wz);
        const valleyStart = WORLD_CONFIG.river.threshold + WORLD_CONFIG.river.transitionWidth;
        const valleyEnd = valleyStart + WORLD_CONFIG.river.valleyInfluenceWidth;
        
        if (dRiver < valleyEnd && adjustedHeight > WORLD_CONFIG.river.valleyTargetHeight) {
          const tVal = 1.0 - (dRiver - valleyStart) / WORLD_CONFIG.river.valleyInfluenceWidth;
          const clampedT = Math.max(0, Math.min(1, tVal));
          const flattenWeight = clampedT * clampedT * (3 - 2 * clampedT);
          const valleyTarget = WORLD_CONFIG.river.valleyTargetHeight;
          adjustedHeight = Math.round(adjustedHeight * (1 - flattenWeight) + valleyTarget * flattenWeight);
        }
        
        if (riverT > 0) {
          const smoothedRiverT = riverT * riverT * (3 - 2 * riverT);
          if (adjustedHeight > riverBedHeight) {
            adjustedHeight = Math.round(adjustedHeight * (1 - smoothedRiverT) + riverBedHeight * smoothedRiverT);
          }
          if (riverT > 0.35) {
            isDryLand = false;
          } else if (isDryLand) {
            const u = riverT / 0.35;
            const minShoreHeight = waterLevel;
            if (adjustedHeight < minShoreHeight) {
              adjustedHeight = Math.round(u * minShoreHeight + (1 - u) * adjustedHeight);
            }
          }
        }

        let isPond = false;
        let pondWaterLevel: number = waterLevel;
        const surfaceHeightForPond = adjustedHeight;
        if (isDryLand) {
          const { isPond: pondActive, bedHeight: pondBedHeight, centerT: pondCenterT, waterLevel: pLevel } = generator.getPondValue(wx, wz, surfaceHeightForPond);
          if (pondCenterT > 0) {
            if (adjustedHeight > pondBedHeight) {
              adjustedHeight = Math.round(adjustedHeight * (1 - pondCenterT) + pondBedHeight * pondCenterT);
            }
            if (pondActive) {
              isPond = true;
              isDryLand = false;
              pondWaterLevel = pLevel;
            }
          }
        }
        
        let localWaterLevel: number = waterLevel;
        if (isPond) {
          localWaterLevel = pondWaterLevel;
        }

        if (isDryLand) {
          const neighbors = [
            [wx + 1, wz], [wx - 1, wz],
            [wx, wz + 1], [wx, wz - 1]
          ];
          let maxAdjacentWaterLevel = 0;
          for (const [nx, nz] of neighbors) {
            const wLevel = generator.getWaterLevelAt(nx, nz);
            if (wLevel > maxAdjacentWaterLevel) {
              maxAdjacentWaterLevel = wLevel;
            }
          }
          if (maxAdjacentWaterLevel > 0 && adjustedHeight < maxAdjacentWaterLevel) {
            adjustedHeight = maxAdjacentWaterLevel;
          }
        }

        const finalHeight = Math.max(3, Math.min(WORLD_HEIGHT - 2, adjustedHeight));

        let maxHeightOffset: number = WORLD_CONFIG.caves.maxHeightOffsetDefault;
        const entranceNoise = noise.noise(wx * 0.02, wz * 0.02);
        if (entranceNoise > 0.35 && finalHeight > WORLD_CONFIG.waterLevel + 5) {
          maxHeightOffset = WORLD_CONFIG.caves.maxHeightOffsetEntrance;
        }

        context.terrainMap[x][z] = {
          interpolatedHeight,
          adjustedHeight,
          finalHeight,
          localWaterLevel,
          isDryLand,
          isPond,
          maxHeightOffset
        };
      }
    }
  }
}
