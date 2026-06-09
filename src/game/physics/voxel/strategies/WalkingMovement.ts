import { getBlockProperties } from '@game/world/World';
import type { IMovementStrategy, MovementContext } from './IMovementStrategy';

export class WalkingMovement implements IMovementStrategy {
  public applyForces(context: MovementContext): void {
    const { position, velocity, inputDirection, dt, isJumping, isShiftLeft, state, settings, world } = context;

    // 探测脚底是否有水，如果有水且按下 shift，不应用冲刺加速
    const blockBelowId = world.getBlock(Math.floor(position.x), Math.floor(position.y - 1.0), Math.floor(position.z));
    const hasWaterBelow = getBlockProperties(blockBelowId).isLiquid;
    
    const speedMultiplier = (isShiftLeft && !state.inWater && !hasWaterBelow) ? 1.5 : 1.0;
    const speed = settings.walkSpeed * speedMultiplier;
    
    velocity.x = inputDirection.x * speed;
    velocity.z = inputDirection.z * speed;

    // 重力
    if (!state.onGround) {
      velocity.y += settings.gravity * dt;
      velocity.y = Math.max(settings.terminalVelocity, velocity.y);
    } else {
      velocity.y = 0;
    }

    // 跳跃
    if (isJumping && state.onGround) {
      velocity.y = settings.jumpSpeed;
      state.onGround = false;
    }
  }
}
