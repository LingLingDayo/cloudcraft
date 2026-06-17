import * as THREE from 'three';
import { World } from '@game/world/World';
import { Entity } from './Entity';

export type EntityCreator = (id: string, spawnPos: THREE.Vector3, world: World) => Entity;

export class EntityRegistry {
  private static registry = new Map<string, EntityCreator>();

  public static register(type: string, creator: EntityCreator): void {
    this.registry.set(type, creator);
  }

  public static create(type: string, id: string, spawnPos: THREE.Vector3, world: World): Entity | null {
    const creator = this.registry.get(type);
    if (!creator) {
      console.warn(`Entity type ${type} is not registered in EntityRegistry`);
      return null;
    }
    return creator(id, spawnPos, world);
  }

  public static getTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  public static has(type: string): boolean {
    return this.registry.has(type);
  }
}
