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
  // A cache entry may span one full yaw step and one full pitch step; their
  // orthogonal rotation composition is tighter than adding both angles.
  directionBucketUncertaintyRadians: 2 * Math.acos(
    Math.cos(DIRECTION_QUANTIZATION_STEP_RADIANS / 2) ** 2,
  ),
  viewParameterPrecision: 1_000,
  viewPositionBucketSizeBlocks: VIEW_POSITION_BUCKET_SIZE_BLOCKS,
  viewPositionBucketUncertaintyRadius: Math.sqrt(3) * VIEW_POSITION_BUCKET_SIZE_BLOCKS,
  viewBasisFallbackThreshold: 0.000_001,
  chunkBoundingSphereRadius: Math.sqrt(3 * 8 * 8),
  worldLoadingBudgetMs: 50,
  gameplayBudgetMs: 8,
  maxConcurrentGeneration: 2,
  maxConcurrentMeshing: 2,
  maxWorkerTaskAttempts: 3,
  verticalPriorityMultiplier: 4,
} as const;

export const CHUNK_VISIBILITY_SCHEMA_VERSION = 1;
