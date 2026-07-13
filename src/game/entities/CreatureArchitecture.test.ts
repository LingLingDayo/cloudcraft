/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { BLOCK_TYPES } from '@type';
import { BehaviorStateMachine } from './behavior/BehaviorStateMachine';
import {
  MovementModeController,
  MovementModeRegistry,
  type MovementMode,
} from './movement/MovementMode';
import { createCoreSpeciesRegistry } from './species/CoreSpecies';
import {
  assertEntitySnapshot,
  createEntitySnapshot,
} from './EntitySnapshot';
import type { World } from '@game/world/World';
import { Animal } from './Animal';

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
    expect(leopard.movementModeIds).toEqual([
      'cloudcraft:swim',
      'cloudcraft:ground',
    ]);
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
  });

  test('enters attack behavior and damages a nearby human', () => {
    const leopard = createCoreSpeciesRegistry()
      .get('cloudcraft:leopard')
      .create('leopard-1', new THREE.Vector3(0, 1, 0), world);

    leopard.update(0.1);

    expect(leopard.getBehaviorStateId()).toBe('attacking');
    expect(takeDamage).toHaveBeenCalledWith(2, world, (world as any).game.physics);
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
