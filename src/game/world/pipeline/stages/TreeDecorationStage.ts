import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';
import { getBiomeAt } from '@game/world/biome/BiomeRegistry';
import { getBlockProperties } from '@game/world/BlockConfig';
import { isCaveAt } from './SurfaceDecorationStage';
import { ChunkBlockWriter } from '@game/world/TreeStructureGenerator';

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
            const col = generator.getColumnTerrainData(wx, wz);
            const finalHeight = col.finalHeight;
            const ty = finalHeight;

            // 矿洞判定：树木生成的地基必须没有被洞穴挖空
            const isGroundCarved = isCaveAt(wx, ty, wz, finalHeight, col.maxHeightOffset, col.localWaterLevel, noise, generator);
            if (isGroundCarved) {
              // 树基被挖空，跳过生成
              continue;
            }

            const groundType = generator.getGroundBlockType(biome, finalHeight, col.localWaterLevel, col.isDryLand && !col.isPond, wx, wz);
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
            }
          }
        }
      }
    }
  }
}

