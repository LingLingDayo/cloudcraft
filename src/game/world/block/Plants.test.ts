/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, test, expect } from 'vitest';
import { World } from '../World';
import { BLOCK_TYPES } from '../BlockConfig';

// Bypass slow WebGL mesh updates globally in this test suite
World.prototype.updateChunkMesh = () => {};
import { BlockRegistry } from './BlockRegistry';
import { ItemRegistry } from '@game/item/ItemRegistry';

// Mock Canvas 2D context to prevent crash in jsdom environment when generating texture atlas
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
}) as any;

describe('Plant and Flower System', () => {
  test('should successfully register all new plants', () => {
    const dandelion = BlockRegistry.get(BLOCK_TYPES.DANDELION);
    expect(dandelion).toBeDefined();
    expect(dandelion.name).toBe('蒲公英');
    expect(dandelion.properties.isCrossModel).toBe(true);

    const poppy = BlockRegistry.get(BLOCK_TYPES.POPPY);
    expect(poppy).toBeDefined();
    expect(poppy.name).toBe('玫瑰');

    const tallGrass = BlockRegistry.get(BLOCK_TYPES.TALL_GRASS);
    expect(tallGrass).toBeDefined();
    expect(tallGrass.name).toBe('草丛');

    const sunflowerBottom = BlockRegistry.get(BLOCK_TYPES.SUNFLOWER_BOTTOM);
    expect(sunflowerBottom).toBeDefined();
    expect(sunflowerBottom.name).toBe('向日葵(底)');
  });

  test('should place flower on grass block and pop it if ground is not valid', () => {
    const world = new World('test-seed');

    // Place a flower on Stone (which is valid ground, allowVegetationBase: true)
    world.setBlock(10, 9, 10, BLOCK_TYPES.STONE);
    world.setBlock(10, 10, 10, BLOCK_TYPES.DANDELION);
    expect(world.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.DANDELION);

    // Place a flower on Air (invalid ground)
    world.setBlock(11, 9, 11, BLOCK_TYPES.AIR);
    world.setBlock(11, 10, 11, BLOCK_TYPES.DANDELION);
    expect(world.getBlock(11, 10, 11)).toBe(BLOCK_TYPES.AIR);

    // Remove the stone ground under the first flower
    world.setBlock(10, 9, 10, BLOCK_TYPES.AIR);
    expect(world.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.AIR);
  });

  test('should support placing double-tall plants (sunflower)', () => {
    const world = new World('test-seed');

    // Prepare space and ground
    world.setBlock(10, 10, 10, BLOCK_TYPES.AIR);
    world.setBlock(10, 11, 10, BLOCK_TYPES.AIR);
    world.setBlock(10, 9, 10, BLOCK_TYPES.GRASS);

    // Place sunflower bottom
    world.setBlock(10, 10, 10, BLOCK_TYPES.SUNFLOWER_BOTTOM);

    // Verify both bottom and top are placed
    expect(world.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.SUNFLOWER_BOTTOM);
    expect(world.getBlock(10, 11, 10)).toBe(BLOCK_TYPES.SUNFLOWER_TOP);
  });

  test('should break both halves when bottom of double plant is destroyed', () => {
    const world = new World('test-seed');

    // Prepare space, ground and place plant
    world.setBlock(10, 10, 10, BLOCK_TYPES.AIR);
    world.setBlock(10, 11, 10, BLOCK_TYPES.AIR);
    world.setBlock(10, 9, 10, BLOCK_TYPES.GRASS);
    world.setBlock(10, 10, 10, BLOCK_TYPES.SUNFLOWER_BOTTOM);

    // Destroy bottom
    world.setBlock(10, 10, 10, BLOCK_TYPES.AIR);

    // Verify both are AIR
    expect(world.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.AIR);
    expect(world.getBlock(10, 11, 10)).toBe(BLOCK_TYPES.AIR);
  });

  test('should break both halves when top of double plant is destroyed', () => {
    const world = new World('test-seed');

    // Prepare space, ground and place plant
    world.setBlock(10, 10, 10, BLOCK_TYPES.AIR);
    world.setBlock(10, 11, 10, BLOCK_TYPES.AIR);
    world.setBlock(10, 9, 10, BLOCK_TYPES.GRASS);
    world.setBlock(10, 10, 10, BLOCK_TYPES.SUNFLOWER_BOTTOM);

    // Destroy top
    world.setBlock(10, 11, 10, BLOCK_TYPES.AIR);

    // Verify both are AIR
    expect(world.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.AIR);
    expect(world.getBlock(10, 11, 10)).toBe(BLOCK_TYPES.AIR);
  });

  test('should break double plant if ground is removed', () => {
    const world = new World('test-seed');

    // Prepare space, ground and place plant
    world.setBlock(10, 10, 10, BLOCK_TYPES.AIR);
    world.setBlock(10, 11, 10, BLOCK_TYPES.AIR);
    world.setBlock(10, 9, 10, BLOCK_TYPES.GRASS);
    world.setBlock(10, 10, 10, BLOCK_TYPES.SUNFLOWER_BOTTOM);

    // Destroy ground
    world.setBlock(10, 9, 10, BLOCK_TYPES.AIR);

    // Verify both halves of plant are gone
    expect(world.getBlock(10, 10, 10)).toBe(BLOCK_TYPES.AIR);
    expect(world.getBlock(10, 11, 10)).toBe(BLOCK_TYPES.AIR);
  });

  test('tall grass and double tall grass drops seed or nothing', () => {
    const tallGrass = BlockRegistry.get(BLOCK_TYPES.TALL_GRASS);
    const doubleTallGrassBottom = BlockRegistry.get(BLOCK_TYPES.DOUBLE_TALL_GRASS_BOTTOM);
    const doubleTallGrassTop = BlockRegistry.get(BLOCK_TYPES.DOUBLE_TALL_GRASS_TOP);

    const checkDrops = (block: any) => {
      let seedCount = 0;
      let emptyCount = 0;
      for (let i = 0; i < 200; i++) {
        const drops = block.getDrops();
        if (drops.length === 0) {
          emptyCount++;
        } else {
          expect(drops.length).toBe(1);
          expect(drops[0].type).toBe('seed');
          expect(drops[0].count).toBe(1);
          seedCount++;
        }
      }
      expect(seedCount).toBeGreaterThan(0);
      expect(emptyCount).toBeGreaterThan(0);
    };

    checkDrops(tallGrass);
    checkDrops(doubleTallGrassBottom);
    checkDrops(doubleTallGrassTop);
  });

  test('seed item registry and food properties', () => {
    const seedItem = ItemRegistry.get('seed' as any);
    expect(seedItem).toBeDefined();
    expect(seedItem.name).toBe('种子');
    expect((seedItem as any).hungerAmount).toBe(0.5);
    expect((seedItem as any).healAmount).toBe(0);

    // 使用新的多态 API: onUse(ctx) 返回 ItemUseResult | null
    const ctxHungry = { player: { hunger: 18, life: 10 }, gameMode: 'adventure' as any };
    const result = seedItem.onUse(ctxHungry);
    expect(result).not.toBeNull();
    expect(result).toEqual({ consumed: true, hungerDelta: 0.5, healDelta: 0 });

    const ctxFull = { player: { hunger: 20, life: 10 }, gameMode: 'adventure' as any };
    expect(seedItem.onUse(ctxFull)).toBeNull();
  });
});
