import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { getBiomeAt } from '@game/world/biome/BiomeRegistry';
import { getBlockProperties } from '@game/world/BlockConfig';
import { isCaveAt } from './SurfaceDecorationStage';
import { ChunkBlockWriter } from '@game/world/TreeStructureGenerator';

export class TreeDecorationStage implements ChunkPipelineStage {
  public name = 'TreeDecoration';

  public execute(context: ChunkPipelineContext): void {
    const { chunk, cx, cz, worldStartX, worldStartY, worldStartZ, noise, generator } = context;

    // 记录在此 Sub-chunk 范围内已经决定长树的坐标，用来做树木防重叠间距控制
    const spawnedTreePositions: { wx: number; wz: number }[] = [];

    for (let ndx = -1; ndx <= 1; ndx++) {
      for (let ndz = -1; ndz <= 1; ndz++) {
        const ncx = cx + ndx;
        const ncz = cz + ndz;
        const nWorldStartX = ncx * 16;
        const nWorldStartZ = ncz * 16;

        const chunkRandom = noise.pseudoRandom2d(ncx, ncz);
        
        // 动态获取邻近区块中心点的 Biome 生态配置，以决定候选树木个数，使得森林/丛林等生态树木极其密集
        const centerBiome = getBiomeAt(nWorldStartX + 8, nWorldStartZ + 8, noise);
        const numTrees = centerBiome.getTreeAttempts(chunkRandom);
        
        for (let t = 0; t < numTrees; t++) {
          const tx = 2 + Math.floor(noise.pseudoRandom2d(ncx * 10 + t, ncz * 10 + t) * 12);
          const tz = 2 + Math.floor(noise.pseudoRandom2d(ncx * 20 + t, ncz * 20 + t) * 12);
          
          const wx = nWorldStartX + tx;
          const wz = nWorldStartZ + tz;
          const biome = getBiomeAt(wx, wz, noise);
          const prob = biome.getTreeProbability(chunkRandom);
          const spawnRand = noise.pseudoRandom2d(wx * 7 + t, wz * 13 + t);

          if (spawnRand < prob) {
            // 防重合分布检查：确保相邻两棵树的主干 X、Z 距离至少相隔 2 格，避免怪物连体树，使分布合理美观
            let tooClose = false;
            for (const pos of spawnedTreePositions) {
              if (Math.abs(wx - pos.wx) < 2 && Math.abs(wz - pos.wz) < 2) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) {
              continue;
            }

            const col = generator.getColumnTerrainData(wx, wz);
            const finalHeight = col.finalHeight;
            const ty = finalHeight;

            // 垂直空间优化剪枝：如果树的基底高度完全在该 Sub-chunk 的垂直影响区间外，则 O(1) 快速跳过，消除 32x 重复计算
            if (ty < worldStartY - 15 || ty > worldStartY + 15) {
              continue;
            }

            // 矿洞判定：树木生成的地基必须没有被洞穴挖空
            const isGroundCarved = isCaveAt(wx, ty, wz, finalHeight, col.maxHeightOffset, col.localWaterLevel, noise, generator);
            if (isGroundCarved) {
              // 树基被挖空，跳过生成
              continue;
            }

            const groundType = generator.getGroundBlockType(biome, finalHeight, col.localWaterLevel, col.isDryLand && !col.isPond, wx, wz, col.slope);
            const isValidGround = getBlockProperties(groundType).allowVegetationBase === true;

            if (isValidGround && ty > col.localWaterLevel - 2) {
              const writer = new ChunkBlockWriter(chunk, worldStartX, worldStartY, worldStartZ);
              biome.growDecorations(
                writer,
                wx,
                ty,
                wz,
                chunkRandom,
                t,
                noise
              );
              // 成功决定生长，记录树干坐标
              spawnedTreePositions.push({ wx, wz });
            }
          }
        }
      }
    }
  }
}

