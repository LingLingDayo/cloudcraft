import type { GameStoreState } from '@store/useGameStore';
import type { GameManager } from '../core/GameManager';
import { createMetaCommands } from './commands/meta';
import { createPlayerCommands } from './commands/player';
import { createWorldCommands } from './commands/world';
import { createTimeCommands } from './commands/time';
import { createRenderCommands } from './commands/render';
import { createStoreCommands } from './commands/store';

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
    meta: createMetaCommands(game),
    player: createPlayerCommands(game),
    world: createWorldCommands(game),
    time: createTimeCommands(game),
    render: createRenderCommands(game),
    store: createStoreCommands(game)
  };
}
