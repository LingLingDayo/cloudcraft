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

  test('keeps active animals when a staged species cannot be created', () => {
    const creationError = new Error('species creation failed');
    const coreSpecies = createCoreSpeciesRegistry();
    const species = new SpeciesRegistry();
    species.register(coreSpecies.get('cloudcraft:pig'));
    species.register({
      ...coreSpecies.get('cloudcraft:pig'),
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
    const stagedPig = currentPig.serialize();

    expect(() => manager.restoreSnapshot({
      schemaVersion: 1,
      entities: [
        { ...stagedPig, id: 'pig-staged' },
        { ...stagedPig, id: 'broken-staged', type: 'cloudcraft:broken' },
      ],
    })).toThrow(creationError);

    expect(manager.getCount()).toBe(1);
    expect(mockGame.scene.add).not.toHaveBeenCalled();
    expect(mockGame.scene.remove).not.toHaveBeenCalled();
  });
});
