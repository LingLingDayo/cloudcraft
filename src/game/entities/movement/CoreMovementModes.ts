import type * as THREE from 'three';
import type { World } from '@game/world/World';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/BlockConfig';
import { VoxelCollider } from '@game/physics/voxel/VoxelCollider';
import { MovementModeRegistry, type MovementMode } from './MovementMode';

const CREATURE_GRAVITY = -18;
const CREATURE_TERMINAL_VELOCITY = -22;
const SWIM_ASCENT_SPEED = 2;
const SWIM_GRAVITY = -4;
const SWIM_TERMINAL_VELOCITY = -1;
const MAX_MOVEMENT_DELTA_SECONDS = 0.1;

export const CoreMovementModeId = {
  GROUND: 'cloudcraft:ground',
  SWIM: 'cloudcraft:swim',
  FLIGHT: 'cloudcraft:flight',
} as const;

export interface CreatureMovementContext {
  readonly world: World;
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly state: { onGround: boolean; inWater: boolean };
  readonly desiredDirection: THREE.Vector3;
  readonly dimensions: { width: number; height: number; depth: number };
  desiredSpeed: number;
  jumpSpeed: number;
  jumpRequested: boolean;
  flightRequested: boolean;
  readonly random: () => number;
}

function applyHorizontalIntent(context: CreatureMovementContext): void {
  context.velocity.x = context.desiredDirection.x * context.desiredSpeed;
  context.velocity.z = context.desiredDirection.z * context.desiredSpeed;
}

function resolveMovement(context: CreatureMovementContext, deltaSeconds: number) {
  return VoxelCollider.resolveMove(
    context.world,
    context.position,
    context.velocity,
    context.dimensions,
    deltaSeconds,
  );
}

const groundMovementMode: MovementMode<CreatureMovementContext> = {
  id: CoreMovementModeId.GROUND,
  canActivate: context => !context.state.inWater && !context.flightRequested,
  update: (context, deltaSeconds) => {
    const stepSeconds = Math.min(deltaSeconds, MAX_MOVEMENT_DELTA_SECONDS);
    applyHorizontalIntent(context);

    if (!context.state.onGround) {
      context.velocity.y = Math.max(
        CREATURE_TERMINAL_VELOCITY,
        context.velocity.y + CREATURE_GRAVITY * stepSeconds,
      );
    } else {
      context.velocity.y = 0;
      if (context.jumpRequested) {
        context.velocity.y = context.jumpSpeed;
        context.state.onGround = false;
        context.jumpRequested = false;
      }
    }

    const velocityX = context.velocity.x;
    const velocityZ = context.velocity.z;
    const result = resolveMovement(context, stepSeconds);
    context.state.onGround = result.onGround;

    if (context.state.onGround && (result.collidedX || result.collidedZ)) {
      const directionX = Math.sign(velocityX || context.desiredDirection.x);
      const directionZ = Math.sign(velocityZ || context.desiredDirection.z);
      const checkX = Math.floor(context.position.x + directionX * 0.45);
      const checkY = Math.floor(context.position.y);
      const checkZ = Math.floor(context.position.z + directionZ * 0.45);
      const headBlock = context.world.getBlock(checkX, checkY + 1, checkZ);
      if (getBlockProperties(headBlock).id === BLOCK_TYPES.AIR) {
        context.jumpRequested = true;
      }
    }
  },
};

const swimmingMovementMode: MovementMode<CreatureMovementContext> = {
  id: CoreMovementModeId.SWIM,
  canActivate: context => context.state.inWater && !context.flightRequested,
  update: (context, deltaSeconds) => {
    const stepSeconds = Math.min(deltaSeconds, MAX_MOVEMENT_DELTA_SECONDS);
    applyHorizontalIntent(context);
    if (context.jumpRequested || context.desiredDirection.lengthSq() > 0.01) {
      context.velocity.y = SWIM_ASCENT_SPEED;
      context.jumpRequested = false;
    } else {
      context.velocity.y = Math.max(
        SWIM_TERMINAL_VELOCITY,
        context.velocity.y + SWIM_GRAVITY * stepSeconds,
      );
    }
    context.state.onGround = resolveMovement(context, stepSeconds).onGround;
  },
};

const flyingMovementMode: MovementMode<CreatureMovementContext> = {
  id: CoreMovementModeId.FLIGHT,
  canActivate: context => context.flightRequested,
  update: (context, deltaSeconds) => {
    const stepSeconds = Math.min(deltaSeconds, MAX_MOVEMENT_DELTA_SECONDS);
    context.velocity.copy(context.desiredDirection).multiplyScalar(context.desiredSpeed);
    context.state.onGround = resolveMovement(context, stepSeconds).onGround;
  },
};

export function createCoreMovementModeRegistry(): MovementModeRegistry<CreatureMovementContext> {
  const registry = new MovementModeRegistry<CreatureMovementContext>();
  registry.register(flyingMovementMode);
  registry.register(swimmingMovementMode);
  registry.register(groundMovementMode);
  registry.freeze();
  return registry;
}

export const coreMovementModeRegistry = createCoreMovementModeRegistry();
