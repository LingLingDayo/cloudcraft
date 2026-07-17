const VIEW_POSITION_BUCKET_SIZE_BLOCKS = 4;
const DIRECTION_QUANTIZATION_STEPS = 32;
const DIRECTION_QUANTIZATION_STEP_RADIANS = Math.PI * 2 / DIRECTION_QUANTIZATION_STEPS;

export const CHUNK_STREAMING_CONFIG = {
  chunkSize: { x: 16, y: 16, z: 16 },
  bytesPerVoxel: 2,
  blockTypeMask: 0x3F,
  faceCount: 6,
  alwaysAvailableNeighborRadius: 1,
  safetyBufferRadius: 1,
  directionQuantizationSteps: DIRECTION_QUANTIZATION_STEPS,
  // Resolution uses the bucket-center direction, so any cached view differs by
  // at most half a yaw step and half a pitch step.
  directionBucketUncertaintyRadians: 2 * Math.acos(
    Math.cos(DIRECTION_QUANTIZATION_STEP_RADIANS / 4) ** 2,
  ),
  viewParameterPrecision: 1_000,
  viewPositionBucketSizeBlocks: VIEW_POSITION_BUCKET_SIZE_BLOCKS,
  viewPositionBucketUncertaintyRadius:
    Math.sqrt(3) * VIEW_POSITION_BUCKET_SIZE_BLOCKS / 2,
  viewBasisFallbackThreshold: 0.000_001,
  // Used when camera aspect/FOV are 0, NaN, or otherwise unusable (e.g. 0x0 canvas).
  // Must NOT fall back to "admit entire sphere" or streaming degenerates to develop-style loads.
  defaultVerticalFovRadians: (75 * Math.PI) / 180,
  defaultAspect: 16 / 9,
  chunkBoundingSphereRadius: Math.sqrt(3 * 8 * 8),
  worldLoadingBudgetMs: 50,
  gameplayBudgetMs: 8,
  maxConcurrentGeneration: 2,
  maxConcurrentMeshing: 2,
  maxWorkerTaskAttempts: 3,
  verticalPriorityMultiplier: 4,
} as const;

export const CHUNK_VISIBILITY_SCHEMA_VERSION = 1;
