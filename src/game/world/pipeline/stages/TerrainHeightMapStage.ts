import type { ChunkPipelineContext, ChunkPipelineStage } from '../ChunkPipelineTypes';

export class TerrainHeightMapStage implements ChunkPipelineStage {
  public name = 'TerrainHeightMap';

  public execute(context: ChunkPipelineContext): void {
    const { worldStartX, worldStartZ, generator } = context;
    
    // Initialize 16x16 maps
    context.terrainMap = [];
    context.biomeMap = [];
    
    for (let x = 0; x < 16; x++) {
      context.terrainMap[x] = [];
      context.biomeMap[x] = [];
      
      for (let z = 0; z < 16; z++) {
        const wx = worldStartX + x;
        const wz = worldStartZ + z;
        
        const { primaryBiome } = generator.getInterpolatedHeightAndBiome(wx, wz);
        context.biomeMap[x][z] = primaryBiome;
        context.terrainMap[x][z] = generator.getColumnTerrainData(wx, wz);
      }
    }
  }
}
