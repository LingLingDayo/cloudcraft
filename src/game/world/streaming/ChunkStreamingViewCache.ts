import { CHUNK_STREAMING_CONFIG } from './ChunkStreamingConfig';
import type { ChunkStreamingView } from './ChunkVisibilityResolver';

export interface ChunkStreamingViewCacheInput {
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly radius: number;
  readonly view: ChunkStreamingView | null;
}

interface ChunkStreamingViewSignature {
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly radius: number;
  readonly yawBucket: number | null;
  readonly pitchBucket: number | null;
  readonly verticalFov: number | null;
  readonly aspect: number | null;
  readonly positionBucketX: number | null;
  readonly positionBucketY: number | null;
  readonly positionBucketZ: number | null;
}

/** Caches the quantized camera signature used by chunk visibility resolution. */
export class ChunkStreamingViewCache {
  private signature: ChunkStreamingViewSignature | null = null;
  private invalidated = true;

  public shouldResolve(input: ChunkStreamingViewCacheInput): boolean {
    const nextSignature = this.createSignature(input);
    const shouldResolve = this.invalidated
      || !this.signature
      || !this.signaturesEqual(this.signature, nextSignature);
    this.signature = nextSignature;
    this.invalidated = false;
    return shouldResolve;
  }

  public invalidate(): void {
    this.invalidated = true;
  }

  public clear(): void {
    this.signature = null;
    this.invalidated = true;
  }

  private createSignature(
    input: ChunkStreamingViewCacheInput,
  ): ChunkStreamingViewSignature {
    const { view } = input;
    if (!view) {
      return {
        centerX: input.centerX,
        centerY: input.centerY,
        centerZ: input.centerZ,
        radius: input.radius,
        yawBucket: null,
        pitchBucket: null,
        verticalFov: null,
        aspect: null,
        positionBucketX: null,
        positionBucketY: null,
        positionBucketZ: null,
      };
    }

    const positionBucketSize = CHUNK_STREAMING_CONFIG.viewPositionBucketSizeBlocks;
    const forwardLength = Math.hypot(view.forward.x, view.forward.y, view.forward.z);
    let yawBucket: number | null = null;
    let pitchBucket: number | null = null;
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

    return {
      centerX: input.centerX,
      centerY: input.centerY,
      centerZ: input.centerZ,
      radius: input.radius,
      yawBucket,
      pitchBucket,
      verticalFov: Math.round(
        view.verticalFovRadians * CHUNK_STREAMING_CONFIG.viewParameterPrecision,
      ),
      aspect: Math.round(view.aspect * CHUNK_STREAMING_CONFIG.viewParameterPrecision),
      positionBucketX: Math.floor(view.position.x / positionBucketSize),
      positionBucketY: Math.floor(view.position.y / positionBucketSize),
      positionBucketZ: Math.floor(view.position.z / positionBucketSize),
    };
  }

  private signaturesEqual(
    current: ChunkStreamingViewSignature,
    next: ChunkStreamingViewSignature,
  ): boolean {
    return current.centerX === next.centerX
      && current.centerY === next.centerY
      && current.centerZ === next.centerZ
      && current.radius === next.radius
      && current.yawBucket === next.yawBucket
      && current.pitchBucket === next.pitchBucket
      && current.verticalFov === next.verticalFov
      && current.aspect === next.aspect
      && current.positionBucketX === next.positionBucketX
      && current.positionBucketY === next.positionBucketY
      && current.positionBucketZ === next.positionBucketZ;
  }
}
