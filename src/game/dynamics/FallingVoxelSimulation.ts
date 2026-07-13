import type {
  DynamicMaterialDefinition,
  DynamicMaterialRegistry,
  FallingVoxelWorldPort,
} from './DynamicMaterialRegistry';
import { BLOCK_TYPES } from '@type';
import {
  assertDynamicMaterialSnapshot,
  type DynamicMaterialSnapshot,
  type FallingVoxelSnapshotBody,
} from './DynamicMaterialSnapshot';

const MAX_INTEGRATION_STEP_SECONDS = 0.05;
const COLLISION_EPSILON = 0.000001;

export interface FallingVoxelBody {
  readonly id: string;
  readonly blockId: number;
  readonly x: number;
  readonly z: number;
  positionY: number;
  velocityY: number;
}

interface ActiveFallingVoxel extends FallingVoxelBody {
  readonly sourceKey: string;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly sourceZ: number;
  readonly definition: DynamicMaterialDefinition;
}

export class FallingVoxelSimulation {
  private readonly registry: DynamicMaterialRegistry;
  private readonly world: FallingVoxelWorldPort;
  private readonly bodies = new Map<string, ActiveFallingVoxel>();
  private readonly activeSourceKeys = new Set<string>();
  private nextBodyId = 0;

  public constructor(
    registry: DynamicMaterialRegistry,
    world: FallingVoxelWorldPort,
  ) {
    this.registry = registry;
    this.world = world;
  }

  public tryDetach(x: number, y: number, z: number): boolean {
    if (!this.world.isInWorldBounds(y)) return false;
    const sourceKey = `${x},${y},${z}`;
    if (this.activeSourceKeys.has(sourceKey)) return false;

    const blockId = this.world.getBlock(x, y, z);
    const definition = this.registry.getByBlockId(blockId);
    if (!definition || !this.isReplaceable(definition, this.world.getBlock(x, y - 1, z))) {
      return false;
    }

    const body: ActiveFallingVoxel = {
      id: `falling-voxel-${this.nextBodyId++}`,
      blockId,
      x,
      z,
      positionY: y + 0.5,
      velocityY: 0,
      sourceKey,
      sourceX: x,
      sourceY: y,
      sourceZ: z,
      definition,
    };
    this.activeSourceKeys.add(sourceKey);
    this.bodies.set(body.id, body);
    this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
    return true;
  }

  public update(deltaSeconds: number): void {
    let remainingSeconds = Math.max(0, deltaSeconds);
    while (remainingSeconds > 0 && this.bodies.size > 0) {
      const stepSeconds = Math.min(remainingSeconds, MAX_INTEGRATION_STEP_SECONDS);
      for (const body of this.bodies.values()) {
        this.updateBody(body, stepSeconds);
      }
      remainingSeconds -= stepSeconds;
    }
  }

  public getBodies(): Iterable<FallingVoxelBody> {
    return this.bodies.values();
  }

  public getActiveCount(): number {
    return this.bodies.size;
  }

  public createSnapshot(): DynamicMaterialSnapshot {
    return {
      schemaVersion: 1,
      bodies: Array.from(this.bodies.values(), body => ({
        blockId: body.blockId,
        x: body.x,
        z: body.z,
        positionY: body.positionY,
        velocityY: body.velocityY,
        source: { x: body.sourceX, y: body.sourceY, z: body.sourceZ },
      })),
    };
  }

  public validateSnapshot(snapshot: unknown): void {
    this.prepareSnapshot(snapshot);
  }

  public restoreSnapshot(snapshot: unknown): void {
    const restoredBodies = this.prepareSnapshot(snapshot);
    this.clear();
    this.nextBodyId = restoredBodies.length;
    for (const body of restoredBodies) {
      this.bodies.set(body.id, body);
      this.activeSourceKeys.add(body.sourceKey);
    }
  }

  public clear(): void {
    this.bodies.clear();
    this.activeSourceKeys.clear();
  }

  private updateBody(body: ActiveFallingVoxel, deltaSeconds: number): void {
    const nextVelocity = Math.max(
      body.definition.terminalVelocity,
      body.velocityY + body.definition.gravity * deltaSeconds,
    );
    const nextPositionY = body.positionY + nextVelocity * deltaSeconds;
    const currentBottomY = body.positionY - 0.5;
    const nextBottomY = nextPositionY - 0.5;
    const firstCrossedCellY = Math.floor(currentBottomY - COLLISION_EPSILON);
    const lastCrossedCellY = Math.floor(nextBottomY);

    for (let supportY = firstCrossedCellY; supportY >= lastCrossedCellY; supportY--) {
      if (!this.world.isInWorldBounds(supportY)) {
        this.removeBody(body);
        return;
      }
      const supportBlock = this.world.getBlock(body.x, supportY, body.z);
      if (!this.isReplaceable(body.definition, supportBlock)) {
        this.landBody(body, supportY + 1);
        return;
      }
    }

    body.velocityY = nextVelocity;
    body.positionY = nextPositionY;
  }

  private landBody(body: ActiveFallingVoxel, targetY: number): void {
    this.world.setBlock(body.x, targetY, body.z, body.blockId);
    this.removeBody(body);
  }

  private removeBody(body: ActiveFallingVoxel): void {
    this.bodies.delete(body.id);
    this.activeSourceKeys.delete(body.sourceKey);
  }

  private prepareSnapshot(snapshot: unknown): ActiveFallingVoxel[] {
    assertDynamicMaterialSnapshot(snapshot);
    return snapshot.bodies.map((body, index) => this.restoreBody(body, index));
  }

  private restoreBody(
    body: FallingVoxelSnapshotBody,
    index: number,
  ): ActiveFallingVoxel {
    const definition = this.registry.getByBlockId(body.blockId);
    if (!definition) {
      throw new Error(`Unknown dynamic block in snapshot: ${body.blockId}`);
    }
    if (
      !this.world.isInWorldBounds(body.source.y)
      || !this.world.isInWorldBounds(Math.floor(body.positionY - 0.5))
    ) {
      throw new Error(`Dynamic material snapshot body is outside world bounds: ${body.blockId}`);
    }
    return {
      id: `falling-voxel-${index}`,
      blockId: body.blockId,
      x: body.x,
      z: body.z,
      positionY: body.positionY,
      velocityY: body.velocityY,
      sourceKey: `${body.source.x},${body.source.y},${body.source.z}`,
      sourceX: body.source.x,
      sourceY: body.source.y,
      sourceZ: body.source.z,
      definition,
    };
  }

  private isReplaceable(
    definition: DynamicMaterialDefinition,
    blockId: number,
  ): boolean {
    return definition.replaceableBlockIds.includes(blockId);
  }
}
