/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { Block, type BlockProperties } from './Block';
import type { World } from '../World';
import { BLOCK_TYPES, BlockType } from '@type';
import { ChestBlockEntity, LeverBlockEntity } from './BlockEntity';
import { sound } from '@game/systems/Sound';


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
    if (!this.canGrowOn(belowType)) {
      // Pop off immediately
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      if (world.game && world.game.droppedItems) {
        const drops = this.getDrops();
        for (const drop of drops) {
          if (drop.count > 0) {
            world.game.droppedItems.spawnItem(drop.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, drop.count);
          }
        }
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
      if (!this.canGrowOn(belowType)) {
        world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        if (world.game && world.game.droppedItems) {
          const drops = this.getDrops();
          for (const drop of drops) {
            if (drop.count > 0) {
              world.game.droppedItems.spawnItem(drop.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, drop.count);
            }
          }
        }
      }
    }
  }
}

export class FlowerBlock extends Block {
  constructor(properties: BlockProperties) {
    super(properties);
  }

  public onPlaced(world: World, x: number, y: number, z: number): void {
    const belowType = world.getBlock(x, y - 1, z);
    if (!this.canGrowOn(belowType)) {
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      if (world.game && world.game.droppedItems) {
        const drops = this.getDrops();
        for (const drop of drops) {
          if (drop.count > 0) {
            world.game.droppedItems.spawnItem(drop.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, drop.count);
          }
        }
      }
    }
  }

  public onNeighborChanged(world: World, x: number, y: number, z: number, _nx: number, ny: number, _nz: number): void {
    if (ny === y - 1) {
      const belowType = world.getBlock(x, y - 1, z);
      if (!this.canGrowOn(belowType)) {
        world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        if (world.game && world.game.droppedItems) {
          const drops = this.getDrops();
          for (const drop of drops) {
            if (drop.count > 0) {
              world.game.droppedItems.spawnItem(drop.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, drop.count);
            }
          }
        }
      }
    }
  }
}

export class DoublePlantBottomBlock extends Block {
  private topBlockId: BlockType;

  constructor(properties: BlockProperties, topBlockId: BlockType) {
    super(properties);
    this.topBlockId = topBlockId;
  }

  public onPlaced(world: World, x: number, y: number, z: number): void {
    const belowType = world.getBlock(x, y - 1, z);
    const aboveType = world.getBlock(x, y + 1, z);

    if (!this.canGrowOn(belowType) || aboveType !== BLOCK_TYPES.AIR) {
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      if (world.game && world.game.droppedItems) {
        const drops = this.getDrops();
        for (const drop of drops) {
          if (drop.count > 0) {
            world.game.droppedItems.spawnItem(drop.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, drop.count);
          }
        }
      }
    } else {
      world.setBlock(x, y + 1, z, this.topBlockId);
    }
  }

  public onNeighborChanged(world: World, x: number, y: number, z: number, _nx: number, _ny: number, _nz: number): void {
    const belowType = world.getBlock(x, y - 1, z);
    
    if (!this.canGrowOn(belowType)) {
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      if (world.game && world.game.droppedItems) {
        const drops = this.getDrops();
        for (const drop of drops) {
          if (drop.count > 0) {
            world.game.droppedItems.spawnItem(drop.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, drop.count);
          }
        }
      }
      return;
    }

    const aboveType = world.getBlock(x, y + 1, z);
    if (aboveType !== this.topBlockId) {
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
    }
  }
}

export class DoublePlantTopBlock extends Block {
  private bottomBlockId: BlockType;

  constructor(properties: BlockProperties, bottomBlockId: BlockType) {
    super(properties);
    this.bottomBlockId = bottomBlockId;
  }

  public onPlaced(world: World, x: number, y: number, z: number): void {
    const belowType = world.getBlock(x, y - 1, z);
    if (belowType !== this.bottomBlockId) {
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
    }
  }

  public onNeighborChanged(world: World, x: number, y: number, z: number, _nx: number, _ny: number, _nz: number): void {
    const belowType = world.getBlock(x, y - 1, z);
    if (belowType !== this.bottomBlockId) {
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
    }
  }
}

export class CactusBlock extends Block {
  constructor(properties: BlockProperties) {
    super(properties);
  }

  public onPlaced(world: World, x: number, y: number, z: number): void {
    const belowType = world.getBlock(x, y - 1, z);
    if (!this.canGrowOn(belowType)) {
      world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      if (world.game && world.game.droppedItems) {
        const drops = this.getDrops();
        for (const drop of drops) {
          if (drop.count > 0) {
            world.game.droppedItems.spawnItem(drop.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, drop.count);
          }
        }
      }
    }
  }

  public onNeighborChanged(world: World, x: number, y: number, z: number, _nx: number, ny: number, _nz: number): void {
    if (ny === y - 1) {
      const belowType = world.getBlock(x, y - 1, z);
      if (!this.canGrowOn(belowType)) {
        world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        if (world.game && world.game.droppedItems) {
          const drops = this.getDrops();
          for (const drop of drops) {
            if (drop.count > 0) {
              world.game.droppedItems.spawnItem(drop.type, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, drop.count);
            }
          }
        }
      }
    }
  }
}


