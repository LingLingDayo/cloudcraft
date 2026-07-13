const VIEW_POSITION_BUCKET_SIZE_BLOCKS = 4;

export const CHUNK_STREAMING_CONFIG = {
  chunkSize: { x: 16, y: 16, z: 16 },
  bytesPerVoxel: 2,
  blockTypeMask: 0x3F,
  faceCount: 6,
  alwaysAvailableNeighborRadius: 1,
  safetyBufferRadius: 1,
  directionQuantizationSteps: 32,
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
