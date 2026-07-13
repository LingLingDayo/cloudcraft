import * as THREE from 'three';
import { GameManager } from './GameManager';
import { Animal } from '../entities/Animal';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';
import { WORLD_HEIGHT } from '@game/world/World';
import { createCoreSpeciesRegistry } from '../entities/species/CoreSpecies';
import type { SpeciesRegistry } from '../entities/species/SpeciesRegistry';
import {
  assertEntitySnapshot,
  createEntitySnapshot,
  type EntitySnapshot,
} from '../entities/EntitySnapshot';

export class AnimalManager {
  private game: GameManager;
  private readonly speciesRegistry: SpeciesRegistry;
  private animals: Animal[] = [];
  private maxAnimals = 8;
  private spawnCheckTimer = 0;
  private spawnCheckInterval = 3.0; // check spawn every 3 seconds

  constructor(game: GameManager, speciesRegistry: SpeciesRegistry = createCoreSpeciesRegistry()) {
    this.game = game;
    this.speciesRegistry = speciesRegistry;
  }

  public createSnapshot(): EntitySnapshot {
    return createEntitySnapshot(this.animals.map(animal => animal.serialize()));
  }

  public restoreSnapshot(snapshot: EntitySnapshot): void {
    assertEntitySnapshot(snapshot);
    const restoredAnimals: Animal[] = [];

    try {
      for (const data of snapshot.entities) {
        const definition = this.speciesRegistry.find(data.type);
        if (!definition) continue;
        const spawnPos = new THREE.Vector3(data.x, data.y, data.z);
        const animal = definition.create(data.id, spawnPos, this.game.world);
        animal.deserialize(data);
        restoredAnimals.push(animal);
      }
    } catch (error) {
      restoredAnimals.forEach(animal => this.disposeAnimalResources(animal));
      throw error;
    }

    const attachedAnimals: Animal[] = [];
    try {
      for (const animal of restoredAnimals) {
        this.game.scene.add(animal.mesh);
        attachedAnimals.push(animal);
      }
    } catch (error) {
      attachedAnimals.forEach(animal => this.game.scene.remove(animal.mesh));
      restoredAnimals.forEach(animal => this.disposeAnimalResources(animal));
      throw error;
    }

    this.dispose();
    this.animals = restoredAnimals;
  }

  public update(dt: number) {
    const playerPos = this.game.player.position;

    // 1. Periodic Spawn & Despawn checks
    this.spawnCheckTimer += dt;
    if (this.spawnCheckTimer >= this.spawnCheckInterval) {
      this.spawnCheckTimer = 0;
      this.checkSpawning(playerPos);
    }

    // 2. Update active animals
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i];
      
      if (animal.isDead) {
        // Spawn death smoke particles
        const particlePos = animal.position.clone().add(new THREE.Vector3(0, 0.45, 0));
        this.game.particles.spawn('cloudcraft:smoke', particlePos, 0xeeeeee, 18);
        
        // Remove from scene and manager list
        this.removeAnimalFromScene(animal);

        this.animals.splice(i, 1);
        continue;
      }

      // Update animal physics/AI
      animal.update(dt);
    }
  }

  private checkSpawning(playerPos: THREE.Vector3) {
    // 1. Despawn animals too far away from the player (e.g. > 64 blocks)
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i];
      if (animal.isPersistent) {
        continue;
      }
      const dist = animal.position.distanceTo(playerPos);
      if (dist > 64.0) {
        this.removeAnimalFromScene(animal);
        this.animals.splice(i, 1);
      }
    }

    // 2. Spawn a new animal if count is low
    if (this.animals.length >= this.maxAnimals) return;

    // Choose random location around player between 16 and 40 blocks away
    const angle = Math.random() * Math.PI * 2;
    const distance = 16.0 + Math.random() * 24.0;
    const spawnX = playerPos.x + Math.sin(angle) * distance;
    const spawnZ = playerPos.z + Math.cos(angle) * distance;

    // Search from chunk top down to find the ground
    const x = Math.floor(spawnX);
    const z = Math.floor(spawnZ);
    let y = WORLD_HEIGHT - 2; // WORLD_HEIGHT - 2 or top of world

    while (y > 0) {
      const blockId = this.game.world.getBlock(x, y, z);
      if (blockId !== BLOCK_TYPES.AIR) {
        // Found a solid block surface
        const props = getBlockProperties(blockId);
        
        // Spawn on grass block only, ensuring the space above is air
        if (props.id === BLOCK_TYPES.GRASS) {
          const space1 = this.game.world.getBlock(x, y + 1, z);
          const space2 = this.game.world.getBlock(x, y + 2, z);
          
          if (space1 === BLOCK_TYPES.AIR && space2 === BLOCK_TYPES.AIR) {
            const spawnPos = new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
            
            const biome = this.game.world.generator.getPrimaryBiome(x, z);
            const species = this.speciesRegistry.selectForHabitat({
              biomeId: biome?.id ?? 'unknown',
              vegetationDensity: biome?.getTreeProbability(0.5) ?? 0,
              surfaceBlockId: props.id,
            }, Math.random());
            if (species) {
              const animalId = `${species.id.split(':').at(-1)}-${Math.random().toString(36).slice(2, 9)}`;
              const animal = species.create(animalId, spawnPos, this.game.world);
              this.game.scene.add(animal.mesh);
              this.animals.push(animal);
            }
            break; // Spawn 1 animal per check maximum
          }
        }
        break; // Hit a solid surface that isn't grass
      }
      y--;
    }
  }

  public checkAttack(): boolean {
    const meshes = this.getAnimalMeshes();
    if (meshes.length === 0) return false;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
    
    const intersects = raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      if (hit.distance < 5.2) {
        // Find owner animal
        const animal = this.getAnimalByMesh(hit.object);
        if (animal) {
          animal.takeDamage(2); // Take 2 HP (1 Heart) damage, sounds are played automatically inside takeDamage()

          // Spawn hit/crit particles (red/pink colors)
          this.game.particles.spawn(
            'cloudcraft:crit',
            hit.point,
            0xff2a4a, // Blood red
            10
          );
          return true; // Attack registered and handled
        }
      }
    }

    return false;
  }

  public getAnimalMeshes(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [];
    this.animals.forEach(a => {
      list.push(...a.mesh.children);
    });
    return list;
  }

  private getAnimalByMesh(mesh: THREE.Object3D): Animal | null {
    let current: THREE.Object3D | null = mesh;
    while (current) {
      for (const animal of this.animals) {
        if (animal.mesh === current) {
          return animal;
        }
      }
      current = current.parent;
    }
    return null;
  }

  public getCount(): number {
    return this.animals.length;
  }

  public markMaterialsDirty() {
    this.animals.forEach(a => {
      a.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((mat) => {
            mat.needsUpdate = true;
          });
        }
      });
    });
  }

  public dispose() {
    this.animals.forEach(a => {
      this.removeAnimalFromScene(a);
    });
    this.animals = [];
  }

  private removeAnimalFromScene(animal: Animal): void {
    this.game.scene.remove(animal.mesh);
    this.disposeAnimalResources(animal);
  }

  private disposeAnimalResources(animal: Animal): void {
    animal.dispose();
    animal.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => material.dispose());
      }
    });
  }
}
