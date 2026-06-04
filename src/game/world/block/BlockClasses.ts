/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { Block, type BlockProperties } from './Block';
import type { World } from '../World';
import { BLOCK_TYPES, getBlockProperties } from '../BlockConfig';
import { ChestBlockEntity, LeverBlockEntity } from './BlockEntity';
import { sound } from '@game/systems/Sound';
import type { BlockType } from '@type';


export class AirBlock extends Block {
  constructor() {
    super({
      id: BLOCK_TYPES.AIR, name: '空气', isSolid: false, isTransparent: true, isLiquid: false,
      hardness: 0, affectedByGravity: false, lightLevel: 0, isInteractable: false, opacity: 0.0,
      soundType: 'none', showBreakCracks: false,
      color: 'transparent', colorHex: 0x000000,
      textureFaces: { top: 0, bottom: 0, side: 0 }
    });
  }
}

export class SimpleSolidBlock extends Block {
  constructor(properties: BlockProperties) {
    super(properties);
  }
}

export class SandBlock extends Block {
  constructor() {
    super({
      id: BLOCK_TYPES.SAND, name: '沙子', isSolid: true, isTransparent: false, isLiquid: false,
      hardness: 0.5, affectedByGravity: true, lightLevel: 0, isInteractable: false, opacity: 1.0,
      soundType: 'sand',
      color: '#dccd8c', colorHex: 0xdccd8c,
      allowVegetationBase: true,
      textureFaces: { top: 10, bottom: 10, side: 10 }
    });
  }

  public onPlaced(world: World, x: number, y: number, z: number): void {
    this.checkGravity(world, x, y, z);
  }

  public onNeighborChanged(world: World, x: number, y: number, z: number, _nx: number, ny: number, _nz: number): void {
    if (ny === y - 1) {
      this.checkGravity(world, x, y, z);
    }
  }


  private checkGravity(world: World, x: number, y: number, z: number) {
    const belowType = world.getBlock(x, y - 1, z);
    if (belowType === BLOCK_TYPES.AIR || belowType === BLOCK_TYPES.WATER) {
      world.addFallingBlock(x, y, z);
    }
  }
}

export class ChestBlock extends Block {
  constructor() {
    super({
      id: 13, // Chest ID
      name: '箱子', isSolid: true, isTransparent: true, isLiquid: false,
      hardness: 2.5, affectedByGravity: false, lightLevel: 0, isInteractable: true, opacity: 1.0,
      soundType: 'wood',
      color: '#78552d', colorHex: 0x78552d, border: '2px solid #5a3c1e',
      textureFaces: { top: 15, bottom: 15, side: 14 }
    });
  }

  public hasBlockEntity(): boolean { return true; }
  public createBlockEntity(x: number, y: number, z: number) {
    return new ChestBlockEntity(x, y, z);
  }

  public onInteract(world: World, x: number, y: number, z: number, _player: any): boolean {
    const entity = world.blockEntities.getEntity(x, y, z);
    if (entity instanceof ChestBlockEntity) {
      sound.playClick();
      const useGameStore = (window as any).useGameStore;
      if (useGameStore) {
        useGameStore.getState().openChest(x, y, z, entity.inventory);
      }
      return true;
    }
    return false;
  }


  public onDestroyed(world: World, x: number, y: number, z: number): void {
    const entity = world.blockEntities.getEntity(x, y, z);
    if (entity instanceof ChestBlockEntity) {
      entity.inventory.forEach(item => {
        if (item) {
          world.game?.droppedItems?.spawnItem(item.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, item.count);
        }
      });
    }
  }
}

export class LeverBlock extends Block {
  constructor() {
    super({
      id: 14, // Lever ID
      name: '拉杆', isSolid: false, isTransparent: true, isLiquid: false,
      hardness: 0.5, affectedByGravity: false, lightLevel: 0, isInteractable: true, opacity: 1.0,
      soundType: 'stone',
      color: '#555555', colorHex: 0x555555,
      textureFaces: { top: 3, bottom: 3, side: 3 }
    });
  }

  public hasBlockEntity(): boolean { return true; }
  public createBlockEntity(x: number, y: number, z: number) {
    return new LeverBlockEntity(x, y, z);
  }

  public onInteract(world: World, x: number, y: number, z: number, _player: any): boolean {
    const entity = world.blockEntities.getEntity(x, y, z);
    if (entity instanceof LeverBlockEntity) {
      entity.active = !entity.active;
      sound.playClick();
      world.notifyNeighborsOfStateChange(x, y, z);
      return true;
    }
    return false;
  }
}

export class LeafBlock extends Block {
  constructor(properties: BlockProperties) {
    super(properties);
  }

  public getDrops(): { type: BlockType; count: number }[] {
    // 树叶挖掘后不掉落树叶本身，但有 10% 概率掉落对应的树苗
    const rand = Math.random();
    if (rand < 0.1) {
      let saplingType: BlockType = BLOCK_TYPES.OAK_SAPLING;
      if (this.id === BLOCK_TYPES.BIRCH_LEAVES) saplingType = BLOCK_TYPES.BIRCH_SAPLING;
      else if (this.id === BLOCK_TYPES.SPRUCE_LEAVES) saplingType = BLOCK_TYPES.SPRUCE_SAPLING;
      else if (this.id === BLOCK_TYPES.JUNGLE_LEAVES) saplingType = BLOCK_TYPES.JUNGLE_SAPLING;

      return [{ type: saplingType, count: 1 }];
    }
    return [];
  }

  public onNeighborChanged(world: World, x: number, y: number, z: number, _nx: number, _ny: number, _nz: number): void {
    // 当邻居改变时，检查是否仍连接树木
    world.checkLeafDecay(x, y, z);
  }
}

export class SaplingBlock extends Block {
  constructor(properties: BlockProperties) {
    super(properties);
  }

  public onPlaced(world: World, x: number, y: number, z: number): void {
    const belowType = world.getBlock(x, y - 1, z);
    const props = getBlockProperties(belowType);
    if (!props.allowVegetationBase) {
      // Pop off immediately
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      if (world.game && world.game.droppedItems) {
        world.game.droppedItems.spawnItem(this.id, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      }
    } else {
      world.registerSapling(x, y, z, this.id);
    }
  }

  public onDestroyed(world: World, x: number, y: number, z: number): void {
    world.unregisterSapling(x, y, z);
  }

  public onNeighborChanged(world: World, x: number, y: number, z: number, _nx: number, ny: number, _nz: number): void {
    if (ny === y - 1) {
      const belowType = world.getBlock(x, y - 1, z);
      const props = getBlockProperties(belowType);
      if (!props.allowVegetationBase) {
        world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        if (world.game && world.game.droppedItems) {
          world.game.droppedItems.spawnItem(this.id, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
        }
      }
    }
  }
}

export class PureItem extends Block {
  constructor(properties: BlockProperties) {
    super({
      ...properties,
      isSolid: false,
      isTransparent: true,
      isLiquid: false,
      hardness: -1,
      isInteractable: false,
      opacity: 0.0,
      soundType: 'none',
      isItem: true,
    });
  }
}
