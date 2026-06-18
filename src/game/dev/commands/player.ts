import { useGameStore } from '@store/useGameStore';
import { BiomeRegistry } from '../../world/biome/BiomeRegistry';
import { LandformRegistry } from '../../world/landform/LandformRegistry';
import type { GameManager } from '../../core/GameManager';

export function createPlayerCommands(game: GameManager) {
  return {
    teleport(x: number, y: number, z: number) {
      if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
        console.error('Teleport coordinates must be numbers: teleport(x, y, z)');
        return;
      }
      game.player.position.set(x, y, z);
      game.player.velocity.set(0, 0, 0);
      game.player.syncCamera();
      console.log(`Teleported player to: ${x}, ${y}, ${z}`);
    },
    teleportToBiome(biomeId: string) {
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
    teleportToLandform(landformId: string) {
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
    setHealth(value: number) {
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
    setHunger(value: number) {
      if (typeof value !== 'number') {
        console.error('Hunger value must be a number: setHunger(value)');
        return;
      }
      const hunger = Math.max(0, Math.min(20, value));
      game.player.hunger = hunger;
      console.log(`Set player hunger to: ${hunger}/20`);
    },
    setFlying(enabled: boolean) {
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
  };
}
