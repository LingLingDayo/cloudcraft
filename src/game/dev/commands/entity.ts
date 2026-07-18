import * as THREE from 'three';
import type { GameManager } from '../../core/GameManager';

export interface EntitySpawnResult {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  life: number;
  isPersistent: boolean;
}

export interface EntityListEntry {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  life: number;
  maxLife: number;
  isPersistent: boolean;
  isDead: boolean;
}

/**
 * 实体 / 生物调试命令。
 * 用于在控制台按物种生成、列出与清理生物，方便 AI 与行为联调。
 */
export function createEntityCommands(game: GameManager) {
  return {
    /** 列出已注册物种 ID（完整命名空间形式） */
    listSpecies(): string[] {
      const ids = game.animals.listSpeciesIds();
      console.log(
        `%c[CloudCraft DevConsole] Registered species (${ids.length}): ${ids.join(', ')}`,
        'color: #4caf50; font-weight: bold;',
      );
      return ids;
    },

    /**
     * 按物种生成一只生物。
     * - 省略坐标时，在玩家前方约 3 格处生成（Y 取玩家脚底高度）。
     * - `speciesId` 支持 `cloudcraft:pig` / `pig` / `leopard` 等短名。
     * - 默认标记为 persistent，不会因远离玩家被自动 despawn。
     */
    spawn(
      speciesId: string,
      x?: number,
      y?: number,
      z?: number,
    ): EntitySpawnResult | null {
      if (typeof speciesId !== 'string' || !speciesId.trim()) {
        console.error(
          'spawn(speciesId, x?, y?, z?): speciesId must be a non-empty string. ' +
            `Try: ${game.animals.listSpeciesIds().join(', ')}`,
        );
        return null;
      }

      const hasCoords =
        typeof x === 'number' && typeof y === 'number' && typeof z === 'number';
      if (
        (x !== undefined || y !== undefined || z !== undefined) &&
        !hasCoords
      ) {
        console.error(
          'spawn(speciesId, x?, y?, z?): provide all three coordinates or none.',
        );
        return null;
      }

      const position = hasCoords
        ? new THREE.Vector3(x, y, z)
        : resolveSpawnInFrontOfPlayer(game);

      const known = game.animals.listSpeciesIds();
      const animal = game.animals.spawnSpecies(speciesId, position, {
        persistent: true,
      });

      if (!animal) {
        console.error(
          `Unknown species "${speciesId}". Valid options: ${known.join(', ')} ` +
            '(short names like "pig" / "leopard" also work).',
        );
        return null;
      }

      const result: EntitySpawnResult = {
        id: animal.id,
        type: animal.type,
        position: {
          x: animal.position.x,
          y: animal.position.y,
          z: animal.position.z,
        },
        life: animal.life,
        isPersistent: animal.isPersistent,
      };

      console.log(
        `%c[CloudCraft DevConsole] Spawned ${result.type} (${result.id}) at ` +
          `(${result.position.x.toFixed(2)}, ${result.position.y.toFixed(2)}, ${result.position.z.toFixed(2)})`,
        'color: #4caf50; font-weight: bold;',
      );
      return result;
    },

    /**
     * 在玩家附近批量生成同一种生物。
     * @param speciesId 物种 ID 或短名
     * @param count 数量，默认 1，上限 16
     * @param radius 水平散布半径（格），默认 4
     */
    spawnMany(
      speciesId: string,
      count = 1,
      radius = 4,
    ): EntitySpawnResult[] {
      if (typeof speciesId !== 'string' || !speciesId.trim()) {
        console.error(
          'spawnMany(speciesId, count?, radius?): speciesId must be a non-empty string.',
        );
        return [];
      }
      if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) {
        console.error('spawnMany: count must be a positive number.');
        return [];
      }
      if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0) {
        console.error('spawnMany: radius must be a non-negative number.');
        return [];
      }

      const n = Math.min(16, Math.floor(count));
      const results: EntitySpawnResult[] = [];
      const origin = game.player.position;

      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.3;
        const dist = radius * (0.35 + Math.random() * 0.65);
        const position = new THREE.Vector3(
          origin.x + Math.cos(angle) * dist,
          origin.y,
          origin.z + Math.sin(angle) * dist,
        );
        const animal = game.animals.spawnSpecies(speciesId, position, {
          persistent: true,
        });
        if (!animal) {
          console.error(
            `Unknown species "${speciesId}". Valid options: ${game.animals.listSpeciesIds().join(', ')}`,
          );
          break;
        }
        results.push({
          id: animal.id,
          type: animal.type,
          position: {
            x: animal.position.x,
            y: animal.position.y,
            z: animal.position.z,
          },
          life: animal.life,
          isPersistent: animal.isPersistent,
        });
      }

      if (results.length > 0) {
        console.log(
          `%c[CloudCraft DevConsole] Spawned ${results.length}× ${results[0].type}`,
          'color: #4caf50; font-weight: bold;',
        );
      }
      return results;
    },

    /** 列出当前场景中的全部生物 */
    list(): EntityListEntry[] {
      const entries: EntityListEntry[] = game.animals.getAnimals().map(animal => ({
        id: animal.id,
        type: animal.type,
        position: {
          x: animal.position.x,
          y: animal.position.y,
          z: animal.position.z,
        },
        life: animal.life,
        maxLife: animal.maxLife,
        isPersistent: animal.isPersistent,
        isDead: animal.isDead,
      }));
      console.table(entries);
      return entries;
    },

    /** 当前生物数量 */
    count(): number {
      const n = game.animals.getCount();
      console.log(`Active animals: ${n}`);
      return n;
    },

    /** 清除全部生物，返回被移除数量 */
    clear(): number {
      const removed = game.animals.clearAnimals();
      console.log(
        `%c[CloudCraft DevConsole] Cleared ${removed} animal(s).`,
        'color: #4caf50; font-weight: bold;',
      );
      return removed;
    },
  };
}

/** 玩家正前方约 3 格、与脚底同高的生成点 */
function resolveSpawnInFrontOfPlayer(game: GameManager): THREE.Vector3 {
  const forward = new THREE.Vector3();
  game.camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) {
    forward.set(0, 0, -1);
  } else {
    forward.normalize();
  }

  return new THREE.Vector3(
    game.player.position.x + forward.x * 3,
    game.player.position.y,
    game.player.position.z + forward.z * 3,
  );
}
