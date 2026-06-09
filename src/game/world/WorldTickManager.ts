import * as THREE from 'three';
import { World } from './World';
import { BLOCK_TYPES } from './BlockConfig';
import { BlockRegistry } from './block/BlockRegistry';
import { TreeStyle } from './biome/Biome';
import { sound } from '@game/systems/Sound';
import { LootTableHelper } from '@game/loot/LootTableHelper';
import type { BlockType } from '@type';
import { WorldBlockWriter } from './TreeStructureGenerator';
import { FeatureRegistry } from './feature/WorldFeature';

export class WorldTickManager {
  private world: World;
  public fallingBlocks: Map<string, { x: number; y: number; z: number; blockId: number; timer: number }>;
  public decayingLeaves: Map<string, { x: number; y: number; z: number; timer: number }>;
  public growingSaplings: Map<string, { x: number; y: number; z: number; timer: number; saplingType: number }>;

  constructor(world: World) {
    this.world = world;
    this.fallingBlocks = new Map();
    this.decayingLeaves = new Map();
    this.growingSaplings = new Map();
  }

  public update(dt: number) {
    // 1. Update falling blocks
    if (this.fallingBlocks.size > 0) {
      const fbs = Array.from(this.fallingBlocks.entries());
      for (const [key, fb] of fbs) {
        fb.timer -= dt;
        if (fb.timer <= 0) {
          this.fallingBlocks.delete(key);
          const currentType = this.world.getBlock(fb.x, fb.y, fb.z);
          if (currentType === fb.blockId) {
            const belowY = fb.y - 1;
            const belowType = this.world.getBlock(fb.x, belowY, fb.z);
            if (belowType === BLOCK_TYPES.AIR || belowType === BLOCK_TYPES.WATER) {
              // Lower sand block by 1 voxel
              this.world.setBlock(fb.x, fb.y, fb.z, BLOCK_TYPES.AIR);
              this.world.setBlock(fb.x, belowY, fb.z, fb.blockId);
              // Recursively trigger next fall check
              this.addFallingBlock(fb.x, belowY, fb.z);
            }
          }
        }
      }
    }

    // 2. Update leaf decay
    if (this.decayingLeaves.size > 0) {
      const leaves = Array.from(this.decayingLeaves.entries());
      for (const [key, dl] of leaves) {
        dl.timer -= dt;
        if (dl.timer <= 0) {
          this.decayingLeaves.delete(key);
          const currentType = this.world.getBlock(dl.x, dl.y, dl.z);
          const cleanType = currentType & 0x3F;
          const isLeaf = cleanType === BLOCK_TYPES.LEAF || 
                         cleanType === BLOCK_TYPES.BIRCH_LEAVES || 
                         cleanType === BLOCK_TYPES.SPRUCE_LEAVES || 
                         cleanType === BLOCK_TYPES.JUNGLE_LEAVES;
          if (isLeaf) {
            if (!this.isConnectedToWood(dl.x, dl.y, dl.z)) {
              this.world.setBlock(dl.x, dl.y, dl.z, BLOCK_TYPES.AIR);
              
              const blockInstance = BlockRegistry.get(currentType);
              if (this.world.game && this.world.game.particles) {
                this.world.game.particles.spawnBlockParticles(
                  new THREE.Vector3(dl.x + 0.5, dl.y + 0.5, dl.z + 0.5),
                  currentType,
                  8
                );
              }
              
              sound.playBreak();

              if (this.world.game && this.world.game.droppedItems) {
                const spawnPos = new THREE.Vector3(dl.x + 0.5, dl.y + 0.5, dl.z + 0.5);
                const context = {
                  world: this.world,
                  position: spawnPos
                };
                if (blockInstance.properties.lootTableId) {
                  LootTableHelper.spawnDrops(blockInstance.properties.lootTableId, context, false);
                } else {
                  const drops = blockInstance.getDrops(context);
                  for (const drop of drops) {
                    this.world.game.droppedItems.spawnItem(
                      drop.type,
                      spawnPos,
                      drop.count
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    // 3. Update sapling growth
    if (this.growingSaplings.size > 0) {
      const saplings = Array.from(this.growingSaplings.entries());
      for (const [key, gs] of saplings) {
        gs.timer -= dt;
        if (gs.timer <= 0) {
          this.growingSaplings.delete(key);
          const currentType = this.world.getBlock(gs.x, gs.y, gs.z);
          if ((currentType & 0x3F) === (gs.saplingType & 0x3F)) {
            this.world.setBlock(gs.x, gs.y, gs.z, BLOCK_TYPES.AIR);

            let woodBlock: BlockType = BLOCK_TYPES.WOOD;
            let leafBlock: BlockType = BLOCK_TYPES.LEAF;
            let style: TreeStyle = TreeStyle.OAK;

            if (gs.saplingType === BLOCK_TYPES.BIRCH_SAPLING) {
              woodBlock = BLOCK_TYPES.BIRCH_WOOD;
              leafBlock = BLOCK_TYPES.BIRCH_LEAVES;
              style = TreeStyle.BIRCH;
            } else if (gs.saplingType === BLOCK_TYPES.SPRUCE_SAPLING) {
              woodBlock = BLOCK_TYPES.SPRUCE_WOOD;
              leafBlock = BLOCK_TYPES.SPRUCE_LEAVES;
              style = TreeStyle.SPRUCE;
            } else if (gs.saplingType === BLOCK_TYPES.JUNGLE_SAPLING) {
              woodBlock = BLOCK_TYPES.JUNGLE_WOOD;
              leafBlock = BLOCK_TYPES.JUNGLE_LEAVES;
              style = TreeStyle.JUNGLE;
            }

            this.spawnTree(gs.x, gs.y, gs.z, woodBlock, leafBlock, style);
          }
        }
      }
    }
  }

  public addFallingBlock(x: number, y: number, z: number) {
    const blockId = this.world.getBlock(x, y, z);
    if (blockId === BLOCK_TYPES.AIR) return;
    const key = `${x},${y},${z}`;
    if (!this.fallingBlocks.has(key)) {
      this.fallingBlocks.set(key, { x, y, z, blockId, timer: 0.1 });
    }
  }

  public registerSapling(x: number, y: number, z: number, saplingType: number) {
    const key = `${x},${y},${z}`;
    // Sapling grows in 10 to 20 seconds
    const growTime = 10.0 + Math.random() * 10.0;
    this.growingSaplings.set(key, { x, y, z, timer: growTime, saplingType });
  }

  public unregisterSapling(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`;
    this.growingSaplings.delete(key);
  }

  public checkLeafDecay(x: number, y: number, z: number) {
    const blockId = this.world.getBlock(x, y, z) & 0x3F;
    const isLeafType = blockId === BLOCK_TYPES.LEAF || 
                       blockId === BLOCK_TYPES.BIRCH_LEAVES || 
                       blockId === BLOCK_TYPES.SPRUCE_LEAVES || 
                       blockId === BLOCK_TYPES.JUNGLE_LEAVES;
    if (!isLeafType) return;

    if (!this.isConnectedToWood(x, y, z)) {
      const key = `${x},${y},${z}`;
      if (!this.decayingLeaves.has(key)) {
        this.decayingLeaves.set(key, { x, y, z, timer: 1.0 + Math.random() * 3.0 });
      }
    } else {
      const key = `${x},${y},${z}`;
      if (this.decayingLeaves.has(key)) {
        this.decayingLeaves.delete(key);
      }
    }
  }

  public isConnectedToWood(startX: number, startY: number, startZ: number): boolean {
    const maxDistance = 4;
    const queue: { x: number; y: number; z: number; dist: number }[] = [];
    const visited = new Set<string>();

    queue.push({ x: startX, y: startY, z: startZ, dist: 0 });
    visited.add(`${startX},${startY},${startZ}`);

    const isWood = (id: number) => {
      const cleanId = id & 0x3F;
      return cleanId === BLOCK_TYPES.WOOD || 
             cleanId === BLOCK_TYPES.BIRCH_WOOD || 
             cleanId === BLOCK_TYPES.SPRUCE_WOOD || 
             cleanId === BLOCK_TYPES.JUNGLE_WOOD;
    };

    const isLeaf = (id: number) => {
      const cleanId = id & 0x3F;
      return cleanId === BLOCK_TYPES.LEAF || 
             cleanId === BLOCK_TYPES.BIRCH_LEAVES || 
             cleanId === BLOCK_TYPES.SPRUCE_LEAVES || 
             cleanId === BLOCK_TYPES.JUNGLE_LEAVES;
    };

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      const currentBlockId = this.world.getBlock(current.x, current.y, current.z);
      if (isWood(currentBlockId)) {
        return true;
      }

      if (current.dist < maxDistance) {
        const neighbors = [
          [1, 0, 0], [-1, 0, 0],
          [0, 1, 0], [0, -1, 0],
          [0, 0, 1], [0, 0, -1]
        ];

        for (const [dx, dy, dz] of neighbors) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          const nz = current.z + dz;
          const key = `${nx},${ny},${nz}`;

          if (!visited.has(key)) {
            visited.add(key);
            const neighborBlockId = this.world.getBlock(nx, ny, nz);
            if (isLeaf(neighborBlockId) || isWood(neighborBlockId)) {
              queue.push({ x: nx, y: ny, z: nz, dist: current.dist + 1 });
            }
          }
        }
      }
    }

    return false;
  }

  public spawnTree(
    x: number,
    y: number,
    z: number,
    _trunkBlock: number,
    _leafBlock: number,
    style: TreeStyle
  ): void {
    let featureId = 'oak_tree';
    if (style === TreeStyle.BIRCH) {
      featureId = 'birch_tree';
    } else if (style === TreeStyle.SPRUCE) {
      featureId = 'spruce_tree';
    } else if (style === TreeStyle.JUNGLE) {
      featureId = 'jungle_tree';
    }

    const feature = FeatureRegistry.get(featureId);
    if (feature) {
      const writer = new WorldBlockWriter(this.world);
      feature.generate(writer, x, y - 1, z, () => Math.random());
    }
  }
}
