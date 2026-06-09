import * as THREE from 'three';
import type { LootContext } from './LootTable';
import { LootTableRegistry } from './LootTableRegistry';

export class LootTableHelper {
  /**
   * 生成指定战利品表对应的掉落物，并调用游戏引擎进行 Spawn 与物理抛射。
   * @param lootTableId 战利品表 ID (命名空间资源定位符，例如 'cloudcraft:entities/pig')
   * @param context 战利品上下文
   * @param spread 是否开启随机初速度扩散（典型应用：生物死亡、方块被挖掘爆开）
   */
  public static spawnDrops(
    lootTableId: string,
    context: LootContext,
    spread: boolean = false
  ): void {
    const table = LootTableRegistry.get(lootTableId);
    if (!table) {
      console.warn(`[LootTableHelper] 未找到指定的战利品表: ${lootTableId}`);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const game = (context.world as any).game;
    if (!game || !game.droppedItems) {
      console.warn('[LootTableHelper] GameManager 实例或 DroppedItemManager 未就绪，无法生成掉落物。');
      return;
    }

    const drops = table.generateLoot(context);
    for (const stack of drops) {
      for (let i = 0; i < stack.count; i++) {
        // 微小的偏移，防止重叠
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 0.25,
          0.1,
          (Math.random() - 0.5) * 0.25
        );
        const spawnPos = context.position.clone().add(offset);

        // 调用游戏接口 spawn 单个掉落物实体
        game.droppedItems.spawnItem(stack.type, spawnPos, 1);

        // 应用扩散物理初速度
        if (spread) {
          const items = game.droppedItems.droppedItems;
          if (items && items.length > 0) {
            const lastItem = items[items.length - 1];
            lastItem.velocity.set(
              (Math.random() - 0.5) * 3,
              4 + Math.random() * 2,
              (Math.random() - 0.5) * 3
            );
          }
        }
      }
    }
  }
}
