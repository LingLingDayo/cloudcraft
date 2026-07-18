import * as THREE from 'three';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GameMode, ItemType } from '@type';
import type { PlacedFixture } from '@game/fixtures/FixtureTypes';
import type { GameManager } from './GameManager';
import { useGameStore } from '@store/useGameStore';
import { sound } from '@game/systems/Sound';
import { InteractionManager } from './InteractionManager';

vi.mock('@game/systems/Sound', () => ({
  sound: {
    playBreak: vi.fn(),
  },
}));

vi.mock('./MiningCrackOverlay', () => ({
  MiningCrackOverlay: class {
    public hide(): void {}
    public dispose(): void {}
    public show(): void {}
  },
}));

interface InteractionTestRuntime {
  readonly interaction: InteractionManager;
  readonly removeFixture: ReturnType<typeof vi.fn>;
  readonly spawnItem: ReturnType<typeof vi.fn>;
  readonly setBlock: ReturnType<typeof vi.fn>;
}

function createFixture(
  definitionId: string,
  components: PlacedFixture['components'] = [],
): PlacedFixture {
  return {
    id: 'fixture-test',
    definitionId,
    anchor: { x: 1, y: 2, z: 3 },
    orientation: 0,
    components,
  };
}

function createInteractionRuntime(
  fixture: PlacedFixture,
  removeResult = true,
  options?: {
    readonly voxelBehindFixture?: boolean;
  },
): InteractionTestRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld();

  const fixtureObject = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  fixtureObject.position.set(0, 0, -2);
  fixtureObject.updateMatrixWorld();

  const removeFixture = vi.fn(() => removeResult);
  const spawnItem = vi.fn();
  const setBlock = vi.fn();
  const getBlock = vi.fn(() => 1); // non-air solid block
  let fixtureRemoved = false;

  removeFixture.mockImplementation(() => {
    if (!removeResult) return false;
    fixtureRemoved = true;
    return true;
  });

  // 体素在设施后方更远，拆除设施后才会被瞄准
  const voxelHit = options?.voxelBehindFixture
    ? {
        target: new THREE.Vector3(0, 0, -4),
        place: new THREE.Vector3(0, 0, -3),
        face: new THREE.Vector3(0, 0, 1),
        blockId: 1,
      }
    : null;

  const game = {
    scene,
    camera,
    controls: { isLocked: false, isMobile: true },
    physics: {
      raycast: vi.fn(() => (options?.voxelBehindFixture ? voxelHit : null)),
    },
    fixtureView: {
      raycast: vi.fn(() => {
        if (fixtureRemoved) return null;
        return {
          fixtureId: fixture.id,
          distance: 2,
          point: fixtureObject.position.clone(),
          object: fixtureObject,
        };
      }),
    },
    fixtures: {
      get: vi.fn(() => (fixtureRemoved ? undefined : fixture)),
      remove: removeFixture,
      place: vi.fn(),
    },
    droppedItems: { spawnItem },
    world: { getBlock, setBlock },
    particles: { spawnBlockParticles: vi.fn() },
  } as unknown as GameManager;

  return {
    interaction: new InteractionManager(game),
    removeFixture,
    spawnItem,
    setBlock,
  };
}

function leftClick(interaction: InteractionManager): void {
  interaction.onMouseDown({ button: 0 } as MouseEvent);
}

describe('InteractionManager fixture removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.setState({ gameMode: GameMode.ADVENTURE });
  });

  test('removes fixtures without drops in creative mode', () => {
    useGameStore.setState({ gameMode: GameMode.CREATIVE });
    const runtime = createInteractionRuntime(createFixture('cloudcraft:fabricator_bench'));

    leftClick(runtime.interaction);

    expect(runtime.removeFixture).toHaveBeenCalledWith('fixture-test');
    expect(runtime.spawnItem).not.toHaveBeenCalled();
    expect(sound.playBreak).toHaveBeenCalledWith('wood');
    runtime.interaction.dispose();
  });

  test('does not instantly break the block behind a creative fixture removal', () => {
    useGameStore.setState({ gameMode: GameMode.CREATIVE });
    const runtime = createInteractionRuntime(
      createFixture('cloudcraft:chest'),
      true,
      { voxelBehindFixture: true },
    );

    leftClick(runtime.interaction);
    // 同一次按住左键进入下一帧的创造连续破坏
    runtime.interaction.update(1 / 60);

    expect(runtime.removeFixture).toHaveBeenCalledWith('fixture-test');
    expect(runtime.setBlock).not.toHaveBeenCalled();
    runtime.interaction.dispose();
  });

  test('recovers an empty fixture as its registered item in survival mode', () => {
    const runtime = createInteractionRuntime(createFixture('cloudcraft:fabricator_bench'));

    leftClick(runtime.interaction);

    expect(runtime.removeFixture).toHaveBeenCalledWith('fixture-test');
    expect(runtime.spawnItem).toHaveBeenCalledWith(
      ItemType.FABRICATOR_BENCH,
      new THREE.Vector3(1.5, 2.5, 3.5),
    );
    expect(sound.playBreak).toHaveBeenCalledWith('wood');
    runtime.interaction.dispose();
  });

  test.each([
    ['container', { type: 'container' as const, slots: [{ type: ItemType.APPLE, count: 1 }] }],
    ['fuel', { type: 'fuel' as const, slots: [{ type: ItemType.COAL, count: 1 }] }],
  ])('preserves fixtures with non-empty %s slots', (_componentType, component) => {
    const runtime = createInteractionRuntime(createFixture('cloudcraft:chest', [component]));

    leftClick(runtime.interaction);

    expect(runtime.removeFixture).not.toHaveBeenCalled();
    expect(runtime.spawnItem).not.toHaveBeenCalled();
    expect(sound.playBreak).not.toHaveBeenCalled();
    runtime.interaction.dispose();
  });

  test('preserves fixtures without a registered item mapping', () => {
    const runtime = createInteractionRuntime(createFixture('cloudcraft:unknown'));

    leftClick(runtime.interaction);

    expect(runtime.removeFixture).not.toHaveBeenCalled();
    expect(runtime.spawnItem).not.toHaveBeenCalled();
    runtime.interaction.dispose();
  });

  test('does not drop an item when fixture removal fails', () => {
    const runtime = createInteractionRuntime(
      createFixture('cloudcraft:fabricator_bench'),
      false,
    );

    leftClick(runtime.interaction);

    expect(runtime.removeFixture).toHaveBeenCalledWith('fixture-test');
    expect(runtime.spawnItem).not.toHaveBeenCalled();
    expect(sound.playBreak).not.toHaveBeenCalled();
    runtime.interaction.dispose();
  });
});
