import type { GameManager } from '../../core/GameManager';

export function createMetaCommands(game: GameManager) {
  return {
    help() {
      console.group('%cCloudCraft DevConsole Available Commands:', 'color: #4caf50; font-weight: bold; font-size: 1.1em;');
      
      const commands = [
        { Namespace: 'meta', Command: 'help()', Description: 'Display this help list' },
        { Namespace: 'meta', Command: 'version', Description: 'Show game version' },
        { Namespace: 'meta', Command: 'seed()', Description: 'Show current world seed' },
        
        { Namespace: 'player', Command: 'teleport(x, y, z)', Description: 'Teleport player to coordinates' },
        { Namespace: 'player', Command: 'teleportToBiome(biomeId)', Description: 'Teleport player to nearest biome (e.g., "desert", "forest")' },
        { Namespace: 'player', Command: 'teleportToLandform(landformId)', Description: 'Teleport player to nearest landform (e.g., "mountains")' },
        { Namespace: 'player', Command: 'setHealth(value)', Description: 'Set player health (0 - 10)' },
        { Namespace: 'player', Command: 'setHunger(value)', Description: 'Set player hunger (0 - 20)' },
        { Namespace: 'player', Command: 'setFlying(enabled)', Description: 'Toggle flight mode (auto switch to creative if needed)' },
        { Namespace: 'player', Command: 'getStatus()', Description: 'Get player details' },
        { Namespace: 'player', Command: 'respawn()', Description: 'Force player to respawn' },
        
        { Namespace: 'world', Command: 'getBlock(x, y, z)', Description: 'Get block ID at position' },
        { Namespace: 'world', Command: 'setBlock(x, y, z, blockType)', Description: 'Set block at position' },
        { Namespace: 'world', Command: 'fill(x1,y1,z1, x2,y2,z2, blockType)', Description: 'Fill area with blockType (max 8192 blocks)' },
        { Namespace: 'world', Command: 'getInfo()', Description: 'Get chunk stats' },
        { Namespace: 'world', Command: 'save()', Description: 'Save world state as JSON string' },
        
        { Namespace: 'time', Command: 'get()', Description: 'Get current game time (seconds)' },
        { Namespace: 'time', Command: 'set(value)', Description: 'Set game time (seconds)' },
        { Namespace: 'time', Command: 'setWeather(id)', Description: 'Set weather ("clear" | "rain" | "storm")' },
        { Namespace: 'time', Command: 'setDimension(id)', Description: 'Set dimension ("overworld" | "nether" | "cave")' },
        
        { Namespace: 'render', Command: 'setRenderDistance(n)', Description: 'Set render distance (2 - 16)' },
        { Namespace: 'render', Command: 'setFov(n)', Description: 'Set camera field of view (30 - 120)' },
        { Namespace: 'render', Command: 'setShadowQuality(quality)', Description: 'Set shadow quality ("simple" | "fancy")' },
        { Namespace: 'render', Command: 'getStats()', Description: 'Get WebGL rendering stats & FPS' },
        
        { Namespace: 'store', Command: 'get()', Description: 'Get Zustand store state snapshot' },
        { Namespace: 'store', Command: 'setGameMode(mode)', Description: 'Set game mode ("adventure" | "creative")' },
        { Namespace: 'store', Command: 'giveItem(itemType, count)', Description: 'Add item to hotbar' },
      ];
      
      console.table(commands);
      console.groupEnd();
    },
    version: '0.3.0',
    seed() {
      return game.world.getSeed();
    }
  };
}
