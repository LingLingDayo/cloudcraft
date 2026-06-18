import * as THREE from 'three';
import { useGameStore } from '@store/useGameStore';
import type { GameStoreState } from '@store/useGameStore';
import { ItemType } from '@type';
import type { GameManager } from '../core/GameManager';
import { BiomeRegistry } from '../world/biome/BiomeRegistry';
import { LandformRegistry } from '../world/landform/LandformRegistry';

export interface CloudcraftDevConsole {
  meta: {
    help(): void;
    version: string;
    seed(): string;
  };
  player: {
    teleport(x: number, y: number, z: number): void;
    teleportToBiome(biomeId: string): void;
    teleportToLandform(landformId: string): void;
    setHealth(value: number): void;
    setHunger(value: number): void;
    setFlying(enabled: boolean): void;
    getStatus(): {
      position: { x: number; y: number; z: number };
      velocity: { x: number; y: number; z: number };
      life: number;
      hunger: number;
      isFlying: boolean;
      onGround: boolean;
    };
    respawn(): void;
  };
  world: {
    getBlock(x: number, y: number, z: number): number;
    setBlock(x: number, y: number, z: number, blockType: number): void;
    fill(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, blockType: number): void;
    getInfo(): {
      seed: string;
      loadedChunks: number;
    };
    save(): string;
  };
  time: {
    get(): number;
    set(value: number): void;
    setWeather(id: string): void;
    setDimension(id: string): void;
  };
  render: {
    setRenderDistance(n: number): void;
    setFov(n: number): void;
    setShadowQuality(quality: 'simple' | 'fancy'): void;
    getStats(): {
      fps: number;
      drawCalls: number;
      triangles: number;
      geometries: number;
      textures: number;
    };
  };
  store: {
    get(): GameStoreState;
    setGameMode(mode: 'adventure' | 'creative'): void;
    giveItem(itemType: string, count?: number): boolean;
  };
}

export function createDevConsole(game: GameManager): CloudcraftDevConsole {
  return {
    meta: {
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
    },
    player: {
      teleport(x, y, z) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
          console.error('Teleport coordinates must be numbers: teleport(x, y, z)');
          return;
        }
        game.player.position.set(x, y, z);
        game.player.velocity.set(0, 0, 0);
        game.player.syncCamera();
        console.log(`Teleported player to: ${x}, ${y}, ${z}`);
      },
      teleportToBiome(biomeId) {
        if (typeof biomeId !== 'string') {
          console.error('Biome ID must be a string: teleportToBiome("desert")');
          return;
        }
        const targetId = biomeId.toLowerCase();
        const validBiomes = BiomeRegistry.getBiomes().map(b => b.id);
        if (!validBiomes.includes(targetId)) {
          console.error(`Invalid Biome ID: "${biomeId}". Valid options are: ${validBiomes.join(', ')}`);
          return;
        }

        const px = Math.floor(game.player.position.x);
        const pz = Math.floor(game.player.position.z);
        
        console.log(`Searching for biome "${targetId}" near (${px}, ${pz})...`);

        let foundX = px;
        let foundZ = pz;
        let found = false;

        const step = 64;
        const maxRadius = 80;
        
        for (let r = 0; r <= maxRadius; r++) {
          if (r === 0) {
            const b = game.world.generator.getPrimaryBiome(px, pz);
            if (b.id === targetId) {
              foundX = px;
              foundZ = pz;
              found = true;
              break;
            }
            continue;
          }

          const rStep = r * step;
          let matchX = 0;
          let matchZ = 0;
          let distanceSq = Infinity;

          const check = (cx: number, cz: number) => {
            const b = game.world.generator.getPrimaryBiome(cx, cz);
            if (b.id === targetId) {
              const dist = (cx - px) ** 2 + (cz - pz) ** 2;
              if (dist < distanceSq) {
                distanceSq = dist;
                matchX = cx;
                matchZ = cz;
                found = true;
              }
            }
          };

          for (let i = -r; i <= r; i++) {
            check(px + i * step, pz - rStep);
            check(px + i * step, pz + rStep);
          }
          for (let i = -r + 1; i <= r - 1; i++) {
            check(px - rStep, pz + i * step);
            check(px + rStep, pz + i * step);
          }

          if (found) {
            foundX = matchX;
            foundZ = matchZ;
            break;
          }
        }

        if (found) {
          const terrainData = game.world.generator.getColumnTerrainData(foundX, foundZ);
          const spawnY = terrainData.finalHeight;
          
          game.world.loadArea(foundX, spawnY, foundZ, game.renderDistance || 4, true);

          game.player.position.set(foundX, spawnY + 2, foundZ);
          game.player.velocity.set(0, 0, 0);
          game.player.syncCamera();
          console.log(`%c[CloudCraft DevConsole] Found biome "${targetId}" at (${foundX}, ${spawnY}, ${foundZ}). Teleported!`, 'color: #4caf50; font-weight: bold;');
        } else {
          console.warn(`Could not find biome "${targetId}" within search radius of 5000 blocks.`);
        }
      },
      teleportToLandform(landformId) {
        if (typeof landformId !== 'string') {
          console.error('Landform ID must be a string: teleportToLandform("mountains")');
          return;
        }
        const targetId = landformId.toLowerCase();
        const validLandforms = LandformRegistry.getLandforms().map(l => l.id);
        if (!validLandforms.includes(targetId)) {
          console.error(`Invalid Landform ID: "${landformId}". Valid options are: ${validLandforms.join(', ')}`);
          return;
        }

        const px = Math.floor(game.player.position.x);
        const pz = Math.floor(game.player.position.z);
        
        console.log(`Searching for landform "${targetId}" near (${px}, ${pz})...`);

        let foundX = px;
        let foundZ = pz;
        let found = false;

        const step = 64;
        const maxRadius = 80;
        
        for (let r = 0; r <= maxRadius; r++) {
          if (r === 0) {
            const l = game.world.generator.getPrimaryLandform(px, pz);
            if (l.id === targetId) {
              foundX = px;
              foundZ = pz;
              found = true;
              break;
            }
            continue;
          }

          const rStep = r * step;
          let matchX = 0;
          let matchZ = 0;
          let distanceSq = Infinity;

          const check = (cx: number, cz: number) => {
            const l = game.world.generator.getPrimaryLandform(cx, cz);
            if (l.id === targetId) {
              const dist = (cx - px) ** 2 + (cz - pz) ** 2;
              if (dist < distanceSq) {
                distanceSq = dist;
                matchX = cx;
                matchZ = cz;
                found = true;
              }
            }
          };

          for (let i = -r; i <= r; i++) {
            check(px + i * step, pz - rStep);
            check(px + i * step, pz + rStep);
          }
          for (let i = -r + 1; i <= r - 1; i++) {
            check(px - rStep, pz + i * step);
            check(px + rStep, pz + i * step);
          }

          if (found) {
            foundX = matchX;
            foundZ = matchZ;
            break;
          }
        }

        if (found) {
          const terrainData = game.world.generator.getColumnTerrainData(foundX, foundZ);
          const spawnY = terrainData.finalHeight;
          
          game.world.loadArea(foundX, spawnY, foundZ, game.renderDistance || 4, true);

          game.player.position.set(foundX, spawnY + 2, foundZ);
          game.player.velocity.set(0, 0, 0);
          game.player.syncCamera();
          console.log(`%c[CloudCraft DevConsole] Found landform "${targetId}" at (${foundX}, ${spawnY}, ${foundZ}). Teleported!`, 'color: #4caf50; font-weight: bold;');
        } else {
          console.warn(`Could not find landform "${targetId}" within search radius of 5000 blocks.`);
        }
      },
      setHealth(value) {
        if (typeof value !== 'number') {
          console.error('Health value must be a number: setHealth(value)');
          return;
        }
        const life = Math.max(0, Math.min(10, value));
        game.player.life = life;
        if (life <= 0) {
          game.player.takeDamage(10, game.world, game.physics);
        }
        console.log(`Set player health to: ${life}/10`);
      },
      setHunger(value) {
        if (typeof value !== 'number') {
          console.error('Hunger value must be a number: setHunger(value)');
          return;
        }
        const hunger = Math.max(0, Math.min(20, value));
        game.player.hunger = hunger;
        console.log(`Set player hunger to: ${hunger}/20`);
      },
      setFlying(enabled) {
        if (typeof enabled !== 'boolean') {
          console.error('Flying state must be a boolean: setFlying(true/false)');
          return;
        }
        const isCreative = useGameStore.getState().gameMode === 'creative';
        if (!isCreative && enabled) {
          console.warn('Flying is only supported in creative mode. Switching game mode to creative.');
          useGameStore.getState().setGameMode('creative');
        }
        game.player.isFlying = enabled;
        console.log(`Set player flying state to: ${enabled}`);
      },
      getStatus() {
        return {
          position: { x: game.player.position.x, y: game.player.position.y, z: game.player.position.z },
          velocity: { x: game.player.velocity.x, y: game.player.velocity.y, z: game.player.velocity.z },
          life: game.player.life,
          hunger: game.player.hunger,
          isFlying: game.player.isFlying,
          onGround: game.player.state.onGround
        };
      },
      respawn() {
        game.player.spawn(game.world, game.physics);
        console.log('Forced player respawn.');
      }
    },
    world: {
      getBlock(x, y, z) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
          console.error('GetBlock coordinates must be numbers: getBlock(x, y, z)');
          return -1;
        }
        return game.world.getBlock(x, y, z);
      },
      setBlock(x, y, z, blockType) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || typeof blockType !== 'number') {
          console.error('SetBlock coordinates and type must be numbers: setBlock(x, y, z, blockType)');
          return;
        }
        game.world.setBlock(x, y, z, blockType);
        console.log(`Set block at (${x}, ${y}, ${z}) to type: ${blockType}`);
      },
      fill(x1, y1, z1, x2, y2, z2, blockType) {
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
    },
    time: {
      get() {
        return game.environment.getGameTime();
      },
      set(value) {
        if (typeof value !== 'number') {
          console.error('Time value must be a number');
          return;
        }
        const dayDuration = game.environment.getDayDuration();
        game.environment.state.gameTime = ((value % dayDuration) + dayDuration) % dayDuration;
        console.log(`Set game time to: ${game.environment.state.gameTime} seconds`);
      },
      setWeather(id) {
        const valid = ['clear', 'rain', 'storm'];
        if (!valid.includes(id)) {
          console.error(`Invalid weather. Valid options are: ${valid.join(', ')}`);
          return;
        }
        game.environment.setWeather(id);
        console.log(`Set weather to: ${id}`);
      },
      setDimension(id) {
        const valid = ['overworld', 'nether', 'cave'];
        if (!valid.includes(id)) {
          console.error(`Invalid dimension. Valid options are: ${valid.join(', ')}`);
          return;
        }
        game.environment.setDimension(id);
        console.log(`Set dimension to: ${id}`);
      }
    },
    render: {
      setRenderDistance(n) {
        if (typeof n !== 'number') {
          console.error('Render distance must be a number');
          return;
        }
        const distance = Math.max(2, Math.min(16, n));
        game.renderDistance = distance;
        const px = Math.floor(game.player.position.x);
        const py = Math.floor(game.player.position.y);
        const pz = Math.floor(game.player.position.z);
        game.world.loadArea(px, py, pz, distance);
        console.log(`Set render distance to: ${distance}`);
      },
      setFov(n) {
        if (typeof n !== 'number') {
          console.error('FOV must be a number');
          return;
        }
        const fov = Math.max(30, Math.min(120, n));
        game.camera.fov = fov;
        game.camera.updateProjectionMatrix();
        console.log(`Set camera FOV to: ${fov}`);
      },
      setShadowQuality(quality) {
        if (quality === 'simple') {
          game.renderer.shadowMap.type = THREE.BasicShadowMap;
        } else if (quality === 'fancy') {
          game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        } else {
          console.error("Invalid shadow quality. Valid options are: 'simple' | 'fancy'");
          return;
        }
        game.renderer.shadowMap.needsUpdate = true;
        game.scene.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh) {
            if (Array.isArray(object.material)) {
              object.material.forEach((m) => (m.needsUpdate = true));
            } else {
              object.material.needsUpdate = true;
            }
          }
        });
        console.log(`Set shadow quality to: ${quality}`);
      },
      getStats() {
        const info = game.renderer.info;
        return {
          fps: Math.round(game.fpsCounter.getFPS()),
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          geometries: info.memory.geometries,
          textures: info.memory.textures
        };
      }
    },
    store: {
      get() {
        return useGameStore.getState();
      },
      setGameMode(mode) {
        if (mode !== 'adventure' && mode !== 'creative') {
          console.error("Invalid game mode. Valid options are: 'adventure' | 'creative'");
          return;
        }
        useGameStore.getState().setGameMode(mode);
        console.log(`Set game mode to: ${mode}`);
      },
      giveItem(itemType, count = 1) {
        const validItemTypes = Object.values(ItemType) as string[];
        if (!validItemTypes.includes(itemType)) {
          console.error(`Invalid itemType: ${itemType}. Valid options are: ${validItemTypes.join(', ')}`);
          return false;
        }
        const success = useGameStore.getState().addToHotbar(itemType as ItemType, count);
        console.log(`Give item ${itemType} (count: ${count}): ${success ? 'SUCCESS' : 'FAILED'}`);
        return success;
      }
    }
  };
}
