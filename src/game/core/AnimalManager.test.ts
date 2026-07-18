/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { AnimalManager } from './AnimalManager';
import { World } from '@game/world/World';
import { Pig } from '../entities/Pig';
import { createCoreSpeciesRegistry } from '../entities/species/CoreSpecies';
import { SpeciesRegistry } from '../entities/species/SpeciesRegistry';

// Mock Canvas 2D context
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

vi.mock('@game/systems/Sound', () => {
  return {
    sound: {
      playPigHurt: vi.fn(),
      playPigDeath: vi.fn(),
      play: vi.fn(),
    },
  };
});

describe('AnimalManager Serialization', () => {
  let mockGame: any;
  let mockWorld: World;

  beforeEach(() => {
    mockWorld = {
      getBlock: vi.fn(() => 0),
    } as unknown as World;

    mockGame = {
      world: mockWorld,
      scene: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
  });

  test('spawnSpecies should create persistent animal by short or full id', () => {
    const manager = new AnimalManager(mockGame);
    const pos = new THREE.Vector3(3, 12, 7);

    const byShort = manager.spawnSpecies('pig', pos);
    expect(byShort).not.toBeNull();
    expect(byShort!.type).toBe('cloudcraft:pig');
    expect(byShort!.isPersistent).toBe(true);
    expect(mockGame.scene.add).toHaveBeenCalledWith(byShort!.mesh);
    expect(manager.getCount()).toBe(1);

    const byFull = manager.spawnSpecies('cloudcraft:leopard', new THREE.Vector3(1, 2, 3));
    expect(byFull).not.toBeNull();
    expect(byFull!.type).toBe('cloudcraft:leopard');
    expect(manager.getCount()).toBe(2);
    expect(manager.listSpeciesIds()).toEqual(['cloudcraft:pig', 'cloudcraft:leopard']);

    expect(manager.spawnSpecies('dragon', pos)).toBeNull();
    expect(manager.clearAnimals()).toBe(2);
    expect(manager.getCount()).toBe(0);
  });

  test('should serialize and deserialize active animals correctly', () => {
    const manager = new AnimalManager(mockGame);
    
    // Create an animal and manually add to the manager list
    const spawnPos = new THREE.Vector3(5, 10, 5);
    const pig = createCoreSpeciesRegistry()
      .get('cloudcraft:pig')
      .create('pig-test-uuid', spawnPos, mockWorld) as Pig;
    pig.velocity.set(0.1, 0, 0.2);
    pig.life = 7;
    pig.isPersistent = true;

    // Manually push to manager's private animals array
    (manager as any).animals.push(pig);

    // Serialize
    const snapshot = manager.createSnapshot();
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.entities.length).toBe(1);
    expect(snapshot.entities[0].id).toBe('pig-test-uuid');
    expect(snapshot.entities[0].type).toBe('cloudcraft:pig');
    expect(snapshot.entities[0].life).toBe(7);
    expect(snapshot.entities[0].isPersistent).toBe(true);

    // Deserialize into a new manager
    const newManager = new AnimalManager(mockGame);
    newManager.restoreSnapshot(snapshot);

    const loadedAnimals = (newManager as any).animals;
    expect(loadedAnimals.length).toBe(1);
    
    const loadedPig = loadedAnimals[0] as Pig;
    expect(loadedPig.id).toBe('pig-test-uuid');
    expect(loadedPig.type).toBe('cloudcraft:pig');
    expect(loadedPig.position.x).toBe(5);
    expect(loadedPig.position.y).toBe(10);
    expect(loadedPig.position.z).toBe(5);
    expect(loadedPig.velocity.x).toBeCloseTo(0.1);
    expect(loadedPig.velocity.z).toBeCloseTo(0.2);
    expect(loadedPig.life).toBe(7);
    expect(loadedPig.isPersistent).toBe(true);
    expect(mockGame.scene.add).toHaveBeenCalledWith(loadedPig.mesh);
  });

  test('keeps active animals when snapshot preflight validation fails', () => {
    const manager = new AnimalManager(mockGame);
    const pig = createCoreSpeciesRegistry()
      .get('cloudcraft:pig')
      .create('pig-current', new THREE.Vector3(5, 10, 5), mockWorld) as Pig;
    (manager as any).animals.push(pig);

    expect(() => manager.restoreSnapshot({
      schemaVersion: 1,
      entities: null,
    } as never)).toThrowError('Entity snapshot entities must be an array');

    expect(manager.getCount()).toBe(1);
    expect(mockGame.scene.remove).not.toHaveBeenCalled();
  });

  test('rejects an unknown species before creating or replacing any animal', () => {
    const coreSpecies = createCoreSpeciesRegistry();
    const pigDefinition = coreSpecies.get('cloudcraft:pig');
    const createPig = vi.fn(pigDefinition.create);
    const species = new SpeciesRegistry();
    species.register({ ...pigDefinition, create: createPig });
    species.freeze();

    const manager = new AnimalManager(mockGame, species);
    const currentPig = pigDefinition.create(
      'pig-current',
      new THREE.Vector3(5, 10, 5),
      mockWorld,
    ) as Pig;
    (manager as any).animals.push(currentPig);
    const serializedPig = currentPig.serialize();

    expect(() => manager.restoreSnapshot({
      schemaVersion: 1,
      entities: [
        { ...serializedPig, id: 'pig-staged' },
        { ...serializedPig, id: 'entity-from-plugin', type: 'plugin:missing-species' },
      ],
    })).toThrowError(/plugin:missing-species.*entity-from-plugin/i);

    expect(createPig).not.toHaveBeenCalled();
    expect((manager as any).animals).toEqual([currentPig]);
    expect(mockGame.scene.add).not.toHaveBeenCalled();
    expect(mockGame.scene.remove).not.toHaveBeenCalled();
  });

  test('reclaims a newly created animal when its snapshot data cannot be restored', () => {
    const restoreError = new Error('animal deserialization failed');
    const coreSpecies = createCoreSpeciesRegistry();
    const pigDefinition = coreSpecies.get('cloudcraft:pig');
    let stagedPig: Pig | null = null;
    const resourceDispose = vi.fn();
    const species = new SpeciesRegistry();
    species.register({
      ...pigDefinition,
      create: (id, position, world) => {
        const animal = pigDefinition.create(id, position, world) as Pig;
        stagedPig = animal;
        vi.spyOn(animal, 'dispose');
        vi.spyOn(animal, 'deserialize').mockImplementation(() => {
          throw restoreError;
        });
        animal.mesh.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry.dispose = resourceDispose;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            material.dispose = resourceDispose;
          });
        });
        return animal;
      },
    });
    species.freeze();

    const manager = new AnimalManager(mockGame, species);
    const currentPig = pigDefinition.create(
      'pig-current',
      new THREE.Vector3(5, 10, 5),
      mockWorld,
    ) as Pig;
    (manager as any).animals.push(currentPig);

    expect(() => manager.restoreSnapshot({
      schemaVersion: 1,
      entities: [{ ...currentPig.serialize(), id: 'pig-staged' }],
    })).toThrow(restoreError);

    expect((manager as any).animals).toEqual([currentPig]);
    expect(mockGame.scene.add).not.toHaveBeenCalled();
    expect(mockGame.scene.remove).not.toHaveBeenCalled();
    expect(stagedPig).not.toBeNull();
    expect(stagedPig!.dispose).toHaveBeenCalledOnce();
    expect(resourceDispose).toHaveBeenCalled();
  });

  test('keeps active animals when a staged species cannot be created', () => {
    const creationError = new Error('species creation failed');
    const coreSpecies = createCoreSpeciesRegistry();
    const pigDefinition = coreSpecies.get('cloudcraft:pig');
    let stagedPig: Pig | null = null;
    const resourceDispose = vi.fn();
    const species = new SpeciesRegistry();
    species.register({
      ...pigDefinition,
      create: (id, position, world) => {
        const animal = pigDefinition.create(id, position, world) as Pig;
        stagedPig = animal;
        vi.spyOn(animal, 'dispose');
        animal.mesh.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry.dispose = resourceDispose;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            material.dispose = resourceDispose;
          });
        });
        return animal;
      },
    });
    species.register({
      ...pigDefinition,
      id: 'cloudcraft:broken',
      create: () => {
        throw creationError;
      },
    });
    species.freeze();

    const manager = new AnimalManager(mockGame, species);
    const currentPig = coreSpecies
      .get('cloudcraft:pig')
      .create('pig-current', new THREE.Vector3(5, 10, 5), mockWorld) as Pig;
    (manager as any).animals.push(currentPig);
    const serializedPig = currentPig.serialize();

    expect(() => manager.restoreSnapshot({
      schemaVersion: 1,
      entities: [
        { ...serializedPig, id: 'pig-staged' },
        { ...serializedPig, id: 'broken-staged', type: 'cloudcraft:broken' },
      ],
    })).toThrow(creationError);

    expect(manager.getCount()).toBe(1);
    expect(mockGame.scene.add).not.toHaveBeenCalled();
    expect(mockGame.scene.remove).not.toHaveBeenCalled();
    expect(stagedPig).not.toBeNull();
    expect(stagedPig!.dispose).toHaveBeenCalledOnce();
    expect(resourceDispose).toHaveBeenCalled();
  });
});
