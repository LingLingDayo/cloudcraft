import { describe, test, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Item, BlockItem, FoodItem } from './Item';
import { ItemRegistry } from './ItemRegistry';
import { ItemType, BLOCK_TYPES } from '@type';
import type { World } from '../world/World';

describe('Item System', () => {
  let mockWorld: World;
  let mockBlockMap: Map<string, number>;

  beforeEach(() => {
    mockBlockMap = new Map();
    mockWorld = {
      getBlock: (x: number, y: number, z: number) => {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        return mockBlockMap.has(key) ? mockBlockMap.get(key)! : BLOCK_TYPES.AIR;
      },
      setBlock: (x: number, y: number, z: number, type: number) => {
        const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
        mockBlockMap.set(key, type);
      },
    } as unknown as World;
  });

  describe('Item Base Class', () => {
    class TestItem extends Item {
      constructor() {
        super({
          id: ItemType.APPLE,
          name: '测试苹果',
          category: 'misc',
          maxStackSize: 64,
        });
      }
    }

    test('should construct base properties correctly', () => {
      const item = new TestItem();
      expect(item.id).toBe(ItemType.APPLE);
      expect(item.name).toBe('测试苹果');
      expect(item.category).toBe('misc');
      expect(item.maxStackSize).toBe(64);
      expect(item.isPlaceable).toBe(false);
      expect(item.isBlockItem).toBe(false);
    });

    test('should return default values for actions', () => {
      const item = new TestItem();
      expect(item.onUse({ player: { life: 20, hunger: 20 }, gameMode: 'adventure' })).toBeNull();
      expect(
        item.onUseOnBlock({
          world: mockWorld,
          targetPos: new THREE.Vector3(0, 0, 0),
          placePos: new THREE.Vector3(0, 1, 0),
          face: new THREE.Vector3(0, 1, 0),
          playerBox: new THREE.Box3(),
          gameMode: 'adventure',
        })
      ).toBe(false);
    });
  });

  describe('FoodItem Subclass', () => {
    test('should restore hunger and health when player is hungry', () => {
      const apple = new FoodItem({
        id: ItemType.APPLE,
        name: '苹果',
        healAmount: 2,
        hungerAmount: 4,
      });

      expect(apple.category).toBe('food');
      expect(apple.healAmount).toBe(2);
      expect(apple.hungerAmount).toBe(4);

      // Player is hungry
      const ctx = {
        player: { life: 10, hunger: 15 },
        gameMode: 'adventure' as const,
      };
      const result = apple.onUse(ctx);
      expect(result).not.toBeNull();
      expect(result!.consumed).toBe(true);
      expect(result!.hungerDelta).toBe(4);
      expect(result!.healDelta).toBe(2);
    });

    test('should not be edible when player is full', () => {
      const apple = new FoodItem({
        id: ItemType.APPLE,
        name: '苹果',
        healAmount: 2,
        hungerAmount: 4,
      });

      // Player is full (hunger >= 20)
      const ctx = {
        player: { life: 20, hunger: 20 },
        gameMode: 'adventure' as const,
      };
      const result = apple.onUse(ctx);
      expect(result).toBeNull();
    });
  });

  describe('BlockItem Subclass', () => {
    test('should have placeable and block properties', () => {
      const stoneItem = new BlockItem({
        id: ItemType.STONE,
        name: '石头',
        blockId: BLOCK_TYPES.STONE,
      });

      expect(stoneItem.isPlaceable).toBe(true);
      expect(stoneItem.isBlockItem).toBe(true);
      expect(stoneItem.blockId).toBe(BLOCK_TYPES.STONE);
    });

    test('should place block successfully if no collision with player', () => {
      const stoneItem = new BlockItem({
        id: ItemType.STONE,
        name: '石头',
        blockId: BLOCK_TYPES.STONE,
      });

      const playerBox = new THREE.Box3(
        new THREE.Vector3(10, 10, 10),
        new THREE.Vector3(10.6, 11.8, 10.6)
      );

      // Place pos is far from player
      const placePos = new THREE.Vector3(15, 10, 15);
      const ctx = {
        world: mockWorld,
        targetPos: new THREE.Vector3(15, 9, 15),
        placePos: placePos,
        face: new THREE.Vector3(0, 1, 0),
        playerBox: playerBox,
        gameMode: 'adventure' as const,
      };

      const placed = stoneItem.onUseOnBlock(ctx);
      expect(placed).toBe(true);
      expect(mockWorld.getBlock(15, 10, 15)).toBe(BLOCK_TYPES.STONE);
    });

    test('should fail to place block if it intersects with player bounding box', () => {
      const stoneItem = new BlockItem({
        id: ItemType.STONE,
        name: '石头',
        blockId: BLOCK_TYPES.STONE,
      });

      // Player is standing exactly where the block would be placed
      // Block bounds: min (10, 10, 10), max (11, 11, 11)
      const playerBox = new THREE.Box3(
        new THREE.Vector3(10.2, 10.2, 10.2),
        new THREE.Vector3(10.8, 12.0, 10.8)
      );

      const placePos = new THREE.Vector3(10, 10, 10);
      const ctx = {
        world: mockWorld,
        targetPos: new THREE.Vector3(10, 9, 10),
        placePos: placePos,
        face: new THREE.Vector3(0, 1, 0),
        playerBox: playerBox,
        gameMode: 'adventure' as const,
      };

      const placed = stoneItem.onUseOnBlock(ctx);
      expect(placed).toBe(false);
      expect(mockWorld.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.AIR);
    });

    test('should encode log orientation correctly when placing log blocks', () => {
      const woodItem = new BlockItem({
        id: ItemType.WOOD,
        name: '原木',
        blockId: BLOCK_TYPES.WOOD,
      });

      const playerBox = new THREE.Box3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.6, 1.8, 0.6)
      );

      // Case 1: Placing on X face
      const placePos1 = new THREE.Vector3(10, 10, 10);
      woodItem.onUseOnBlock({
        world: mockWorld,
        targetPos: new THREE.Vector3(9, 10, 10),
        placePos: placePos1,
        face: new THREE.Vector3(1, 0, 0), // face.x !== 0
        playerBox: playerBox,
        gameMode: 'adventure',
      });
      // Should encode block ID with (1 << 6)
      expect(mockWorld.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.WOOD | (1 << 6));

      // Case 2: Placing on Z face
      const placePos2 = new THREE.Vector3(11, 10, 11);
      woodItem.onUseOnBlock({
        world: mockWorld,
        targetPos: new THREE.Vector3(11, 10, 10),
        placePos: placePos2,
        face: new THREE.Vector3(0, 0, 1), // face.z !== 0
        playerBox: playerBox,
        gameMode: 'adventure',
      });
      // Should encode block ID with (2 << 6)
      expect(mockWorld.getBlock(11, 10, 11)).toBe(BLOCK_TYPES.WOOD | (2 << 6));

      // Case 3: Placing on Y face
      const placePos3 = new THREE.Vector3(12, 10, 12);
      woodItem.onUseOnBlock({
        world: mockWorld,
        targetPos: new THREE.Vector3(12, 9, 12),
        placePos: placePos3,
        face: new THREE.Vector3(0, 1, 0), // face.y !== 0
        playerBox: playerBox,
        gameMode: 'adventure',
      });
      // Should encode base block ID
      expect(mockWorld.getBlock(12, 10, 12)).toBe(BLOCK_TYPES.WOOD);
    });

    test('should return correct sound type', () => {
      const stoneItem = new BlockItem({
        id: ItemType.STONE,
        name: '石头',
        blockId: BLOCK_TYPES.STONE,
      });
      expect(stoneItem.getPlaceSoundType()).toBe('stone');

      const grassItem = new BlockItem({
        id: ItemType.GRASS,
        name: '草方块',
        blockId: BLOCK_TYPES.GRASS,
      });
      expect(grassItem.getPlaceSoundType()).toBe('grass');
    });
  });

  describe('ItemRegistry', () => {
    test('should retrieve registered food items', () => {
      const porkchop = ItemRegistry.get(ItemType.PORKCHOP);
      expect(porkchop).toBeDefined();
      expect(porkchop.id).toBe(ItemType.PORKCHOP);
      expect(porkchop.category).toBe('food');
      expect((porkchop as FoodItem).hungerAmount).toBe(3);

      const apple = ItemRegistry.get(ItemType.APPLE);
      expect(apple).toBeDefined();
      expect(apple.id).toBe(ItemType.APPLE);
      expect(apple.category).toBe('food');
      expect((apple as FoodItem).hungerAmount).toBe(4);
    });

    test('should fallback to default item when item not found', () => {
      // Pass a non-existent item id
      const unknownItem = ItemRegistry.get('unknown_id' as unknown as ItemType);
      expect(unknownItem).toBeDefined();
      expect(unknownItem.id).toBe(ItemType.GRASS); // default item is GRASS
    });

    test('should correctly convert block type to item type', () => {
      expect(ItemRegistry.getItemTypeFromBlockType(BLOCK_TYPES.STONE)).toBe(ItemType.STONE);
      expect(ItemRegistry.getItemTypeFromBlockType(BLOCK_TYPES.GRASS)).toBe(ItemType.GRASS);
      expect(ItemRegistry.getItemTypeFromBlockType(BLOCK_TYPES.AIR)).toBeNull();
    });

    test('should correctly convert item type to block type', () => {
      expect(ItemRegistry.getBlockTypeFromItemType(ItemType.STONE)).toBe(BLOCK_TYPES.STONE);
      expect(ItemRegistry.getBlockTypeFromItemType(ItemType.GRASS)).toBe(BLOCK_TYPES.GRASS);
      expect(ItemRegistry.getBlockTypeFromItemType(ItemType.APPLE)).toBe(BLOCK_TYPES.AIR); // Food items don't have block types
    });

    test('should query items by category', () => {
      const foodItems = ItemRegistry.getFoodItems();
      expect(foodItems.length).toBeGreaterThan(0);
      foodItems.forEach((item) => expect(item.category).toBe('food'));

      const blockItems = ItemRegistry.getPlaceableItems();
      expect(blockItems.length).toBeGreaterThan(0);
      blockItems.forEach((item) => expect(item.category).toBe('block'));
    });

    test('should return all registered items', () => {
      const allItems = ItemRegistry.getAllItems();
      expect(allItems.length).toBeGreaterThan(0);
    });
  });
});
