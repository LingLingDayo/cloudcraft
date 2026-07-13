import { CHUNK_STREAMING_CONFIG } from './ChunkStreamingConfig';
import type { ChunkStreamingView } from './ChunkVisibilityResolver';

/** Caches the quantized camera signature used by chunk visibility resolution. */
export class ChunkStreamingViewCache {
  private initialized = false;
  private invalidated = true;
  private centerX = 0;
  private centerY = 0;
  private centerZ = 0;
  private radius = 0;
  private yawBucket: number | null = null;
  private pitchBucket: number | null = null;
  private verticalFov: number | null = null;
  private aspect: number | null = null;
  private positionBucketX: number | null = null;
  private positionBucketY: number | null = null;
  private positionBucketZ: number | null = null;

  public shouldResolve(
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    view: ChunkStreamingView | null,
  ): boolean {
    let yawBucket: number | null = null;
    let pitchBucket: number | null = null;
    let verticalFov: number | null = null;
    let aspect: number | null = null;
    let positionBucketX: number | null = null;
    let positionBucketY: number | null = null;
    let positionBucketZ: number | null = null;
    if (view) {
      const positionBucketSize = CHUNK_STREAMING_CONFIG.viewPositionBucketSizeBlocks;
      const forwardLength = Math.hypot(view.forward.x, view.forward.y, view.forward.z);
      if (forwardLength > 0) {
        const directionStep = Math.PI * 2 / CHUNK_STREAMING_CONFIG.directionQuantizationSteps;
        const rawYawBucket = Math.round(
          Math.atan2(view.forward.x, view.forward.z) / directionStep,
        );
        yawBucket = (
          rawYawBucket % CHUNK_STREAMING_CONFIG.directionQuantizationSteps
          + CHUNK_STREAMING_CONFIG.directionQuantizationSteps
        ) % CHUNK_STREAMING_CONFIG.directionQuantizationSteps;
        pitchBucket = Math.round(
          Math.asin(Math.max(-1, Math.min(1, view.forward.y / forwardLength))) / directionStep,
        );
      }
      verticalFov = Math.round(
        view.verticalFovRadians * CHUNK_STREAMING_CONFIG.viewParameterPrecision,
      );
      aspect = Math.round(view.aspect * CHUNK_STREAMING_CONFIG.viewParameterPrecision);
      positionBucketX = Math.floor(view.position.x / positionBucketSize);
      positionBucketY = Math.floor(view.position.y / positionBucketSize);
      positionBucketZ = Math.floor(view.position.z / positionBucketSize);
    }

    const shouldResolve = this.invalidated
      || !this.initialized
      || this.centerX !== centerX
      || this.centerY !== centerY
      || this.centerZ !== centerZ
      || this.radius !== radius
      || this.yawBucket !== yawBucket
      || this.pitchBucket !== pitchBucket
      || this.verticalFov !== verticalFov
      || this.aspect !== aspect
      || this.positionBucketX !== positionBucketX
      || this.positionBucketY !== positionBucketY
      || this.positionBucketZ !== positionBucketZ;
    this.centerX = centerX;
    this.centerY = centerY;
    this.centerZ = centerZ;
    this.radius = radius;
    this.yawBucket = yawBucket;
    this.pitchBucket = pitchBucket;
    this.verticalFov = verticalFov;
    this.aspect = aspect;
    this.positionBucketX = positionBucketX;
    this.positionBucketY = positionBucketY;
    this.positionBucketZ = positionBucketZ;
    this.initialized = true;
    this.invalidated = false;
    return shouldResolve;
  }

  public invalidate(): void {
    this.invalidated = true;
  }

  public clear(): void {
    this.initialized = false;
    this.invalidated = true;
  }
}
