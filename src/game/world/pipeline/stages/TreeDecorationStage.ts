import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { getBiomeAt } from '../../biome/BiomeRegistry';
import { getBlockProperties } from '../../BlockConfig';
import { WORLD_CONFIG } from '../../WorldConfig';
import { WORLD_HEIGHT } from '../../World';
import { TreeStyle } from '../../biome/Biome';
import { isCaveAt } from './SurfaceDecorationStage';
import { ChunkBlockWriter, TreeStructureGenerator } from '../../TreeStructureGenerator';

export class TreeDecorationStage implements ChunkPipelineStage {
  public name = 'TreeDecoration';

  public execute(context: ChunkPipelineContext): void {
    const { chunk, cx, cz, worldStartX, worldStartY, worldStartZ, noise, generator } = context;

    for (let ndx = -1; ndx <= 1; ndx++) {
      for (let ndz = -1; ndz <= 1; ndz++) {
        const ncx = cx + ndx;
        const ncz = cz + ndz;
        const nWorldStartX = ncx * 16;
        const nWorldStartZ = ncz * 16;

        const chunkRandom = noise.pseudoRandom2d(ncx, ncz);
        const numTrees = Math.floor(chunkRandom * 12) % 3 + 1;
        
        for (let t = 0; t < numTrees; t++) {
          const tx = 2 + Math.floor(noise.pseudoRandom2d(ncx * 10 + t, ncz * 10 + t) * 12);
          const tz = 2 + Math.floor(noise.pseudoRandom2d(ncx * 20 + t, ncz * 20 + t) * 12);
          
          const wx = nWorldStartX + tx;
          const wz = nWorldStartZ + tz;
          const biome = getBiomeAt(wx, wz, noise);

          const prob = biome.getTreeProbability(chunkRandom);
          const spawnRand = noise.pseudoRandom2d(wx * 7 + t, wz * 13 + t);
          if (spawnRand < prob) {
            const { height: interpolatedHeight } = generator.getInterpolatedHeightAndBiome(wx, wz);
            
            let adjustedHeight = interpolatedHeight;
            let isDryLand = true;

            const oceanNoise = noise.noise(wx * WORLD_CONFIG.ocean.scale, wz * WORLD_CONFIG.ocean.scale);
            const waterLevel = WORLD_CONFIG.waterLevel;

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
            const ty = finalHeight;

            // 矿洞判定：树木生成的地基必须没有被洞穴挖空
            let maxHeightOffset: number = WORLD_CONFIG.caves.maxHeightOffsetDefault;
            const entranceNoise = noise.noise(wx * 0.02, wz * 0.02);
            if (entranceNoise > 0.35 && finalHeight > WORLD_CONFIG.waterLevel + 5) {
              maxHeightOffset = WORLD_CONFIG.caves.maxHeightOffsetEntrance;
            }
            
            const isGroundCarved = isCaveAt(wx, ty, wz, finalHeight, maxHeightOffset, localWaterLevel, noise, generator);
            if (isGroundCarved) {
              // 树基被挖空，跳过生成
              continue;
            }

            const groundType = generator.getGroundBlockType(biome, finalHeight, localWaterLevel, isDryLand && !isPond, wx, wz);
            const isValidGround = getBlockProperties(groundType).allowVegetationBase === true;

            if (isValidGround && ty > waterLevel - 2) {
              const localGrowTree = (
                _chunk: Uint8Array,
                ltx: number,
                lty: number,
                ltz: number,
                trunkBlock: number,
                leafBlock: number,
                height: number,
                style: TreeStyle
              ) => {
                const gBaseX = nWorldStartX + ltx;
                const gBaseY = lty;
                const gBaseZ = nWorldStartZ + ltz;

                const writer = new ChunkBlockWriter(chunk, worldStartX, worldStartY, worldStartZ);
                TreeStructureGenerator.growTree(
                  writer,
                  gBaseX,
                  gBaseY,
                  gBaseZ,
                  trunkBlock,
                  leafBlock,
                  height,
                  style,
                  (wlx, wly, wlz) => noise.pseudoRandom2d(wlx * 17 + gBaseX, wlz * 23 + gBaseZ + wly)
                );
              };

              biome.growDecorations(
                chunk,
                tx,
                ty,
                tz,
                chunkRandom,
                t,
                localGrowTree
              );
            }
          }
        }
      }
    }
  }
}
