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
  private readonly representativeView = {
    position: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    verticalFovRadians: CHUNK_STREAMING_CONFIG.defaultVerticalFovRadians,
    aspect: CHUNK_STREAMING_CONFIG.defaultAspect,
  } satisfies ChunkStreamingView;

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
      const resolvedVerticalFov = (
        Number.isFinite(view.verticalFovRadians)
        && view.verticalFovRadians > 0
        && view.verticalFovRadians < Math.PI
      )
        ? view.verticalFovRadians
        : CHUNK_STREAMING_CONFIG.defaultVerticalFovRadians;
      const resolvedAspect = Number.isFinite(view.aspect) && view.aspect > 0
        ? view.aspect
        : CHUNK_STREAMING_CONFIG.defaultAspect;
      verticalFov = Math.round(
        resolvedVerticalFov * CHUNK_STREAMING_CONFIG.viewParameterPrecision,
      );
      aspect = Math.round(
        resolvedAspect * CHUNK_STREAMING_CONFIG.viewParameterPrecision,
      );
      if (
        Number.isFinite(view.position.x)
        && Number.isFinite(view.position.y)
        && Number.isFinite(view.position.z)
      ) {
        positionBucketX = Math.floor(view.position.x / positionBucketSize);
        positionBucketY = Math.floor(view.position.y / positionBucketSize);
        positionBucketZ = Math.floor(view.position.z / positionBucketSize);
      }
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

  /** Returns the bucket-center view covered by the configured uncertainty margins. */
  public getRepresentativeView(view: ChunkStreamingView | null): ChunkStreamingView | null {
    if (!view) return null;

    const positionBucketSize = CHUNK_STREAMING_CONFIG.viewPositionBucketSizeBlocks;
    if (
      this.positionBucketX !== null
      && this.positionBucketY !== null
      && this.positionBucketZ !== null
    ) {
      this.representativeView.position.x = (
        this.positionBucketX + 0.5
      ) * positionBucketSize;
      this.representativeView.position.y = (
        this.positionBucketY + 0.5
      ) * positionBucketSize;
      this.representativeView.position.z = (
        this.positionBucketZ + 0.5
      ) * positionBucketSize;
    } else {
      this.representativeView.position.x = view.position.x;
      this.representativeView.position.y = view.position.y;
      this.representativeView.position.z = view.position.z;
    }

    if (this.yawBucket !== null && this.pitchBucket !== null) {
      const directionStep = Math.PI * 2 / CHUNK_STREAMING_CONFIG.directionQuantizationSteps;
      const yaw = this.yawBucket * directionStep;
      const pitch = this.pitchBucket * directionStep;
      const horizontalScale = Math.cos(pitch);
      this.representativeView.forward.x = Math.sin(yaw) * horizontalScale;
      this.representativeView.forward.y = Math.sin(pitch);
      this.representativeView.forward.z = Math.cos(yaw) * horizontalScale;
    } else {
      this.representativeView.forward.x = view.forward.x;
      this.representativeView.forward.y = view.forward.y;
      this.representativeView.forward.z = view.forward.z;
    }

    const parameterPrecision = CHUNK_STREAMING_CONFIG.viewParameterPrecision;
    this.representativeView.verticalFovRadians = this.verticalFov === null
      ? CHUNK_STREAMING_CONFIG.defaultVerticalFovRadians
      : Math.min(Math.PI, (this.verticalFov + 0.5) / parameterPrecision);
    this.representativeView.aspect = this.aspect === null
      ? CHUNK_STREAMING_CONFIG.defaultAspect
      : (this.aspect + 0.5) / parameterPrecision;
    return this.representativeView;
  }

  public invalidate(): void {
    this.invalidated = true;
  }

  public clear(): void {
    this.initialized = false;
    this.invalidated = true;
  }
}
