/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { BLOCK_TYPES } from '@type';
// 确保方块属性 resolver 已初始化，供视线/碰撞判定使用
import '@game/world/block/BlockRegistry';
import { BehaviorStateMachine } from './behavior/BehaviorStateMachine';
import {
  MovementModeController,
  MovementModeRegistry,
  type MovementMode,
} from './movement/MovementMode';
import { createCoreSpeciesRegistry } from './species/CoreSpecies';
import { SpeciesRegistry } from './species/SpeciesRegistry';
import {
  assertEntitySnapshot,
  createEntitySnapshot,
} from './EntitySnapshot';
import type { World } from '@game/world/World';
import { Animal } from './Animal';
import {
  blendVegetationDensity,
  sampleLocalVegetationDensity,
} from './sensing/HabitatSampling';
import { hasBlockLineOfSight } from './sensing/LineOfSight';
import {
  createExtendedMovementModeRegistry,
  CoreMovementModeId,
} from './movement/CoreMovementModes';
import { sound } from '@game/systems/Sound';

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

vi.mock('@game/systems/Sound', () => ({
  sound: {
    play: vi.fn(),
    playDamage: vi.fn(),
    playBreak: vi.fn(),
    playLeopardHurt: vi.fn(),
    playLeopardDeath: vi.fn(),
    playPigHurt: vi.fn(),
    playPigDeath: vi.fn(),
  },
}));

class LifecycleTestAnimal extends Animal {
  public width = 0.8;
  public height = 0.9;
  public depth = 0.8;
  protected walkSpeed = 1;
  protected panicSpeed = 2;
  protected jumpSpeed = 4;
  public hurtSound = '';
  public deathSound = '';

  public constructor(world: World, onExit: () => void) {
    super(
      'lifecycle-test-animal',
      'test:lifecycle',
      new THREE.Vector3(),
      world,
      10,
      ['cloudcraft:ground'],
    );
    this.registerBehaviorState({ id: 'lifecycle-active', onExit });
    this.transitionBehavior('lifecycle-active');
  }

  public initMesh(): void {}
}

describe('BehaviorStateMachine', () => {
  test('transitions leaf states while retaining hierarchical parent membership', () => {
    const context = { seesTarget: false, events: [] as string[] };
    const machine = new BehaviorStateMachine<typeof context>();
    machine.registerState({ id: 'active' });
    machine.registerState({
      id: 'idle',
      parentId: 'active',
      onExit: state => state.events.push('exit:idle'),
    });
    machine.registerState({
      id: 'chasing',
      parentId: 'active',
      onEnter: state => state.events.push('enter:chasing'),
    });
    machine.registerTransition({
      from: 'idle',
      to: 'chasing',
      when: state => state.seesTarget,
    });
    machine.start('idle', context);

    context.seesTarget = true;
    machine.update(context, 0.1);

    expect(machine.currentStateId).toBe('chasing');
    expect(machine.isInState('active')).toBe(true);
    expect(context.events).toEqual(['exit:idle', 'enter:chasing']);
  });

  test('reuses resolved state lineage during frame updates and membership checks', () => {
    let parentReads = 0;
    const context = { updates: 0 };
    const machine = new BehaviorStateMachine<typeof context>();
    machine.registerState({ id: 'active' });
    machine.registerState({
      id: 'idle',
      get parentId() {
        parentReads++;
        return 'active';
      },
      onUpdate: state => {
        state.updates++;
      },
    });
    machine.start('idle', context);
    parentReads = 0;

    machine.update(context, 0.1);
    machine.update(context, 0.1);
    expect(machine.isInState('active')).toBe(true);
    expect(machine.isInState('idle')).toBe(true);

    expect(context.updates).toBe(2);
    expect(parentReads).toBe(0);
  });
});

describe('Animal lifecycle', () => {
  test('exits the active behavior exactly once when disposed', () => {
    const onExit = vi.fn();
    const world = { getBlock: vi.fn(() => BLOCK_TYPES.AIR) } as unknown as World;
    const animal = new LifecycleTestAnimal(world, onExit);

    animal.dispose();
    animal.dispose();

    expect(onExit).toHaveBeenCalledOnce();
  });
});

describe('MovementModeController', () => {
  test('selects and switches among configured movement modes at runtime', () => {
    interface Context { inWater: boolean; updates: string[] }
    const registry = new MovementModeRegistry<Context>();
    const ground: MovementMode<Context> = {
      id: 'ground',
      canActivate: () => true,
      update: context => context.updates.push('ground'),
    };
    const swim: MovementMode<Context> = {
      id: 'swim',
      canActivate: context => context.inWater,
      update: context => context.updates.push('swim'),
    };
    registry.register(ground);
    registry.register(swim);
    registry.freeze();
    const registryLookup = vi.spyOn(registry, 'get');
    const controller = new MovementModeController(registry, ['swim', 'ground']);
    const context = { inWater: false, updates: [] as string[] };
    registryLookup.mockClear();

    controller.update(context, 0.1);
    context.inWater = true;
    controller.update(context, 0.1);

    expect(context.updates).toEqual(['ground', 'swim']);
    expect(controller.activeModeId).toBe('swim');
    expect(registryLookup).not.toHaveBeenCalled();
  });
});

describe('core species definitions', () => {
  test('makes leopards rare and strongly prefers tree-rich habitats', () => {
    const registry = createCoreSpeciesRegistry();
    const pig = registry.get('cloudcraft:pig');
    const leopard = registry.get('cloudcraft:leopard');
    const forestScore = leopard.scoreHabitat({
      biomeId: 'forest',
      vegetationDensity: 0.8,
      surfaceBlockId: BLOCK_TYPES.GRASS,
    });
    const plainsScore = leopard.scoreHabitat({
      biomeId: 'plains',
      vegetationDensity: 0.05,
      surfaceBlockId: BLOCK_TYPES.GRASS,
    });

    expect(leopard.spawnWeight).toBeLessThan(pig.spawnWeight);
    expect(forestScore).toBeGreaterThan(plainsScore * 5);
    expect(leopard.hostileToHumans).toBe(true);
    expect(leopard.combat?.requireLineOfSight).toBe(true);
    expect(leopard.movementModeIds).toEqual([
      'cloudcraft:swim',
      'cloudcraft:ground',
    ]);
  });

  test('rejects hostile species without a combat profile', () => {
    const registry = new SpeciesRegistry();
    expect(() => registry.register({
      id: 'test:broken-hostile',
      spawnWeight: 1,
      movementModeIds: [CoreMovementModeId.GROUND],
      hostileToHumans: true,
      scoreHabitat: () => 1,
      create: () => {
        throw new Error('unused');
      },
    })).toThrowError(/missing combat profile/i);
  });
});

describe('habitat sampling', () => {
  test('scores local vegetation columns and blends biome probability', () => {
    const world = {
      getBlock: vi.fn((x: number, _y: number, z: number) => {
        if (x === 0 && z === 0) return BLOCK_TYPES.LEAF;
        if (x === 1 && z === 0) return BLOCK_TYPES.WOOD;
        return BLOCK_TYPES.AIR;
      }),
    } as unknown as World;

    const density = sampleLocalVegetationDensity(world, 0, 10, 0, 1);
    // radius 1 => 3x3 = 9 columns, 2 hits
    expect(density).toBeCloseTo(2 / 9, 5);
    expect(blendVegetationDensity(1, 0, 0.75)).toBeCloseTo(0.75);
    expect(blendVegetationDensity(0, 1, 0.75)).toBeCloseTo(0.25);
  });
});

describe('line of sight', () => {
  test('blocks awareness through opaque solid cubes but not through air', () => {
    const openWorld = {
      getBlock: vi.fn(() => BLOCK_TYPES.AIR),
    } as unknown as World;
    const walledWorld = {
      getBlock: vi.fn((x: number) => (x === 1 ? BLOCK_TYPES.STONE : BLOCK_TYPES.AIR)),
    } as unknown as World;
    const from = new THREE.Vector3(0, 1, 0);
    const to = new THREE.Vector3(2, 1, 0);

    expect(hasBlockLineOfSight(openWorld, from, to)).toBe(true);
    expect(hasBlockLineOfSight(walledWorld, from, to)).toBe(false);
  });
});

describe('movement mode extension', () => {
  test('allows injecting extended movement mode registries into animals', () => {
    const registry = createExtendedMovementModeRegistry([
      {
        id: 'test:climb',
        canActivate: context => !context.state.inWater && !context.flightRequested,
        update: () => {},
      },
    ], { freeze: true });

    expect(registry.get('test:climb').id).toBe('test:climb');
    expect(registry.get(CoreMovementModeId.GROUND).id).toBe(CoreMovementModeId.GROUND);
    expect(() => registry.register({
      id: 'test:another',
      canActivate: () => true,
      update: () => {},
    })).toThrowError(/frozen/i);
  });
});

describe('Leopard', () => {
  let takeDamage: ReturnType<typeof vi.fn>;
  let world: World;

  beforeEach(() => {
    takeDamage = vi.fn();
    world = {
      getBlock: vi.fn((_x: number, y: number) => y <= 0 ? BLOCK_TYPES.STONE : BLOCK_TYPES.AIR),
      game: {
        player: {
          position: new THREE.Vector3(0.5, 1, 0),
          takeDamage,
        },
        physics: {},
      },
    } as unknown as World;
    vi.mocked(sound.play).mockClear();
  });

  test('enters attack behavior and damages a nearby human', () => {
    const leopard = createCoreSpeciesRegistry()
      .get('cloudcraft:leopard')
      .create('leopard-1', new THREE.Vector3(0, 1, 0), world);

    leopard.update(0.1);

    expect(leopard.getBehaviorStateId()).toBe('attacking');
    expect(takeDamage).toHaveBeenCalledWith(2, world, (world as any).game.physics);
  });

  test('enters stalking when human is in awareness range but outside attack range', () => {
    (world.game as any).player.position.set(8, 1, 0);
    const leopard = createCoreSpeciesRegistry()
      .get('cloudcraft:leopard')
      .create('leopard-stalk', new THREE.Vector3(0, 1, 0), world);

    leopard.update(0.1);

    expect(leopard.getBehaviorStateId()).toBe('stalking');
    expect(takeDamage).not.toHaveBeenCalled();
  });

  test('does not attack through opaque walls when line of sight is required', () => {
    world.getBlock = vi.fn((x: number, y: number) => {
      if (y <= 0) return BLOCK_TYPES.STONE;
      if (x === 1) return BLOCK_TYPES.STONE;
      return BLOCK_TYPES.AIR;
    }) as World['getBlock'];
    (world.game as any).player.position.set(2, 1, 0);

    const leopard = createCoreSpeciesRegistry()
      .get('cloudcraft:leopard')
      .create('leopard-los', new THREE.Vector3(0, 1, 0), world);

    leopard.update(0.1);

    expect(leopard.getBehaviorStateId()).toBe('wandering');
    expect(takeDamage).not.toHaveBeenCalled();
  });

  test('preserves panic timer and attack cooldown across snapshot restore', () => {
    const leopard = createCoreSpeciesRegistry()
      .get('cloudcraft:leopard')
      .create('leopard-save', new THREE.Vector3(0, 1, 0), world);

    leopard.update(0.1);
    expect(leopard.getBehaviorStateId()).toBe('attacking');
    expect(takeDamage).toHaveBeenCalledOnce();

    leopard.takeDamage(1);
    expect(leopard.getBehaviorStateId()).toBe('panicked');
    const serialized = leopard.serialize();
    expect(serialized.customData?.aiTimer).toBe(5);
    expect(typeof serialized.customData?.attackCooldownSeconds).toBe('number');
    expect(serialized.customData?.attackCooldownSeconds).toBeGreaterThan(0);

    const restored = createCoreSpeciesRegistry()
      .get('cloudcraft:leopard')
      .create('leopard-temp', new THREE.Vector3(9, 1, 9), world);
    restored.deserialize(serialized);

    expect(restored.getBehaviorStateId()).toBe('panicked');
    expect(restored.getAttackCooldownSeconds()).toBeCloseTo(
      Number(serialized.customData?.attackCooldownSeconds),
    );

    restored.update(0.05);
    expect(restored.getBehaviorStateId()).toBe('panicked');

    // 惊慌结束后可再进入战斗，但冷却未耗尽时不应立刻补刀
    takeDamage.mockClear();
    restored.deserialize({
      ...serialized,
      customData: {
        ...serialized.customData!,
        behaviorStateId: 'attacking',
        aiTimer: 0,
        attackCooldownSeconds: 0.8,
      },
    });
    restored.update(0.05);
    expect(restored.getBehaviorStateId()).toBe('attacking');
    expect(takeDamage).not.toHaveBeenCalled();
  });

  test('plays leopard hurt sound through SoundManager method keys', () => {
    const leopard = createCoreSpeciesRegistry()
      .get('cloudcraft:leopard')
      .create('leopard-sfx', new THREE.Vector3(0, 1, 0), world);

    leopard.takeDamage(1);

    expect(sound.play).toHaveBeenCalledWith('playLeopardHurt');
  });
});

describe('EntitySnapshot', () => {
  test('wraps heterogeneous entities in a versioned snapshot contract', () => {
    const snapshot = createEntitySnapshot([
      {
        id: 'pig-1',
        type: 'pig',
        x: 1,
        y: 2,
        z: 3,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 10,
        maxLife: 10,
        isPersistent: true,
      },
    ]);

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.entities[0].type).toBe('pig');
    expect(() => assertEntitySnapshot({ ...snapshot, schemaVersion: 2 } as never))
      .toThrowError('Unsupported entity snapshot schema version: 2');
  });

  test('deeply detaches extension data from the live entity payload', () => {
    const movementModeIds = ['cloudcraft:ground', 'cloudcraft:swim'];
    const snapshot = createEntitySnapshot([{
      id: 'pig-detached',
      type: 'cloudcraft:pig',
      x: 1,
      y: 2,
      z: 3,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 8,
      maxLife: 10,
      isPersistent: true,
      customData: { movementModeIds },
    }]);

    movementModeIds[0] = 'cloudcraft:flying';

    expect(snapshot.entities[0].customData?.movementModeIds).toEqual([
      'cloudcraft:ground',
      'cloudcraft:swim',
    ]);
  });

  test('rejects malformed entity entries before runtime restoration', () => {
    const malformed = {
      schemaVersion: 1,
      entities: [{
        id: 'pig-invalid',
        type: 'cloudcraft:pig',
        x: Number.POSITIVE_INFINITY,
        y: 2,
        z: 3,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 8,
        maxLife: 10,
        isPersistent: true,
      }],
    };

    expect(() => assertEntitySnapshot(malformed as never))
      .toThrowError('Entity snapshot contains invalid numeric data at pig-invalid');
  });
});
