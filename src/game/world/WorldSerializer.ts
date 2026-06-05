import { World } from './World';

export class WorldSerializer {
  // Serialize world to JSON (only saves modified blocks to keep save size minimal)
  public static saveWorld(world: World): string {
    const serializedModified: Record<string, Record<string, number>> = {};
    for (const [chunkKey, modifiedMap] of world.modifiedBlocks.entries()) {
      if (modifiedMap.size > 0) {
        const chunkData: Record<string, number> = {};
        for (const [posKey, type] of modifiedMap.entries()) {
          chunkData[posKey] = type;
        }
        serializedModified[chunkKey] = chunkData;
      }
    }
    return JSON.stringify({
      seed: world.getSeed(),
      modified: serializedModified,
      entities: world.blockEntities.serialize()
    });
  }

  // Load world from JSON
  public static loadWorld(world: World, saveStr: string): void {
    try {
      const saved = JSON.parse(saveStr);
      if (saved.seed) {
        world.setSeed(saved.seed);
      }
      
      // Clear current meshes
      const renderer = world.getRenderer();
      const chunkMeshes = renderer.getChunkMeshes();
      for (const key of chunkMeshes.keys()) {
        renderer.removeChunkMesh(key);
      }
      chunkMeshes.clear();
      world.chunks.clear();
      world.modifiedBlocks.clear();

      // Restore modified blocks
      if (saved.modified) {
        for (const [chunkKey, chunkData] of Object.entries(saved.modified)) {
          const keyParts = chunkKey.split(',');
          const isLegacy2D = keyParts.length === 2;
          
          if (isLegacy2D) {
            const cx = parseInt(keyParts[0], 10);
            const cz = parseInt(keyParts[1], 10);
            for (const [posKey, type] of Object.entries(chunkData as Record<string, number>)) {
              const posParts = posKey.split(',');
              if (posParts.length === 3) {
                const lx = parseInt(posParts[0], 10);
                const y = parseInt(posParts[1], 10);
                const lz = parseInt(posParts[2], 10);
                
                const cy = Math.floor(y / 16);
                const ly = ((y % 16) + 16) % 16;
                const newChunkKey = `${cx},${cy},${cz}`;
                const newPosKey = `${lx},${ly},${lz}`;
                
                let modifiedMap = world.modifiedBlocks.get(newChunkKey);
                if (!modifiedMap) {
                  modifiedMap = new Map<string, number>();
                  world.modifiedBlocks.set(newChunkKey, modifiedMap);
                }
                modifiedMap.set(newPosKey, type);
              }
            }
          } else {
            const modifiedMap = new Map<string, number>();
            for (const [posKey, type] of Object.entries(chunkData as Record<string, number>)) {
              modifiedMap.set(posKey, type);
            }
            world.modifiedBlocks.set(chunkKey, modifiedMap);
          }
        }
      }

      if (saved.entities) {
        world.blockEntities.deserialize(saved.entities);
      } else {
        world.blockEntities.clear();
      }
    } catch (e) {
      console.error('Failed to load world', e);
    }
  }
}

