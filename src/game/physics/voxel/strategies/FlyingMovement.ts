import type { IMovementStrategy, MovementContext } from './IMovementStrategy';

export class FlyingMovement implements IMovementStrategy {
  public applyForces(context: MovementContext): void {
    const { velocity, inputDirection, isJumping, isShiftLeft, state, settings } = context;

    const flySpeedMultiplier = isShiftLeft ? 1.5 : 1.0;
    const flySpeed = settings.walkSpeed * 2.0 * flySpeedMultiplier;
    
    velocity.x = inputDirection.x * flySpeed;
    velocity.z = inputDirection.z * flySpeed;

    const verticalMove = (isJumping ? 1 : 0) + (isShiftLeft ? -1 : 0);
    velocity.y = verticalMove * settings.walkSpeed * 1.5 * flySpeedMultiplier;

    state.onGround = false;
  }
}
