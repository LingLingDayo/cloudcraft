import type {
  DynamicMaterialDefinition,
  DynamicMaterialRegistry,
  FallingVoxelWorldPort,
} from './DynamicMaterialRegistry';
import { BLOCK_TYPES } from '@type';

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
    this.bodies.delete(body.id);
    this.activeSourceKeys.delete(body.sourceKey);
  }

  private isReplaceable(
    definition: DynamicMaterialDefinition,
    blockId: number,
  ): boolean {
    return definition.replaceableBlockIds.includes(blockId);
  }
}
