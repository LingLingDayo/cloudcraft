import type { GameManager } from '../../core/GameManager';

export function createWorldCommands(game: GameManager) {
  return {
    getBlock(x: number, y: number, z: number) {
      if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
        console.error('GetBlock coordinates must be numbers: getBlock(x, y, z)');
        return -1;
      }
      return game.world.getBlock(x, y, z);
    },
    setBlock(x: number, y: number, z: number, blockType: number) {
      if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || typeof blockType !== 'number') {
        console.error('SetBlock coordinates and type must be numbers: setBlock(x, y, z, blockType)');
        return;
      }
      game.world.setBlock(x, y, z, blockType);
      console.log(`Set block at (${x}, ${y}, ${z}) to type: ${blockType}`);
    },
    fill(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, blockType: number) {
      if (
        typeof x1 !== 'number' || typeof y1 !== 'number' || typeof z1 !== 'number' ||
        typeof x2 !== 'number' || typeof y2 !== 'number' || typeof z2 !== 'number' ||
        typeof blockType !== 'number'
      ) {
        console.error('Fill coordinates and type must be numbers');
        return;
      }
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      const minZ = Math.min(z1, z2);
      const maxZ = Math.max(z1, z2);
      const total = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);
      if (total > 8192) {
        throw new Error(`Total blocks to fill (${total}) exceeds limit of 8192`);
      }
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            game.world.setBlock(x, y, z, blockType);
          }
        }
      }
      console.log(`Filled ${total} blocks from (${minX},${minY},${minZ}) to (${maxX},${maxY},${maxZ}) with type: ${blockType}`);
    },
    getInfo() {
      return {
        seed: game.world.getSeed(),
        loadedChunks: game.world.chunks.size
      };
    },
    save() {
      return game.world.saveWorld();
    }
  };
}
