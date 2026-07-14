import { getBlockProperties } from '../BlockConfig';
import {
  CHUNK_STREAMING_CONFIG,
  CHUNK_VISIBILITY_SCHEMA_VERSION,
} from './ChunkStreamingConfig';

export const ChunkFace = {
  NegativeX: 0,
  PositiveX: 1,
  NegativeY: 2,
  PositiveY: 3,
  NegativeZ: 4,
  PositiveZ: 5,
} as const;

export type ChunkFace = typeof ChunkFace[keyof typeof ChunkFace];

export interface ChunkVisibilitySummary {
  readonly schemaVersion: number;
  readonly chunkRevision: number;
  readonly openFacesMask: number;
  readonly portalMask: number;
}

const FACE_DIRECTIONS = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
] as const;

function getPortalBitIndex(firstFace: ChunkFace, secondFace: ChunkFace): number {
  const lowerFace = Math.min(firstFace, secondFace);
  const upperFace = Math.max(firstFace, secondFace);
  let bitIndex = 0;

  for (let face = 0; face < lowerFace; face++) {
    bitIndex += CHUNK_STREAMING_CONFIG.faceCount - face - 1;
  }

  return bitIndex + upperFace - lowerFace - 1;
}

function getBoundaryFaces(x: number, y: number, z: number): number {
  const { x: sizeX, y: sizeY, z: sizeZ } = CHUNK_STREAMING_CONFIG.chunkSize;
  let faceMask = 0;
  if (x === 0) faceMask |= 1 << ChunkFace.NegativeX;
  if (x === sizeX - 1) faceMask |= 1 << ChunkFace.PositiveX;
  if (y === 0) faceMask |= 1 << ChunkFace.NegativeY;
  if (y === sizeY - 1) faceMask |= 1 << ChunkFace.PositiveY;
  if (z === 0) faceMask |= 1 << ChunkFace.NegativeZ;
  if (z === sizeZ - 1) faceMask |= 1 << ChunkFace.PositiveZ;
  return faceMask;
}

function addComponentPortals(portalMask: number, componentFacesMask: number): number {
  let nextPortalMask = portalMask;
  for (let first = 0; first < CHUNK_STREAMING_CONFIG.faceCount; first++) {
    if ((componentFacesMask & (1 << first)) === 0) continue;
    for (let second = first + 1; second < CHUNK_STREAMING_CONFIG.faceCount; second++) {
      if ((componentFacesMask & (1 << second)) === 0) continue;
      nextPortalMask |= 1 << getPortalBitIndex(first as ChunkFace, second as ChunkFace);
    }
  }
  return nextPortalMask;
}

/**
 * Builds the compact six-face portal topology for a two-byte-per-voxel chunk.
 * Production callers run this flood fill in the world worker.
 */
export function buildChunkVisibilitySummary(
  chunk: Uint8Array,
  chunkRevision: number,
): ChunkVisibilitySummary {
  const { x: sizeX, y: sizeY, z: sizeZ } = CHUNK_STREAMING_CONFIG.chunkSize;
  const chunkVolume = sizeX * sizeY * sizeZ;
  const expectedLength = chunkVolume * CHUNK_STREAMING_CONFIG.bytesPerVoxel;
  if (chunk.length !== expectedLength) {
    throw new RangeError(`Expected chunk data length ${expectedLength}, received ${chunk.length}`);
  }

  const visited = new Uint8Array(chunkVolume);
  const queue = new Int32Array(chunkVolume);
  const transparencyByBlock = new Int8Array(CHUNK_STREAMING_CONFIG.blockTypeMask + 1);
  transparencyByBlock.fill(-1);

  const isTransparentVoxel = (index: number): boolean => {
    const blockType = chunk[index * CHUNK_STREAMING_CONFIG.bytesPerVoxel]
      & CHUNK_STREAMING_CONFIG.blockTypeMask;
    const cached = transparencyByBlock[blockType];
    if (cached >= 0) return cached === 1;
    const transparent = getBlockProperties(blockType).isTransparent;
    transparencyByBlock[blockType] = transparent ? 1 : 0;
    return transparent;
  };

  let openFacesMask = 0;
  let portalMask = 0;

  for (let startIndex = 0; startIndex < chunkVolume; startIndex++) {
    if (visited[startIndex] !== 0 || !isTransparentVoxel(startIndex)) continue;

    let readIndex = 0;
    let writeIndex = 0;
    let componentFacesMask = 0;
    visited[startIndex] = 1;
    queue[writeIndex++] = startIndex;

    while (readIndex < writeIndex) {
      const index = queue[readIndex++];
      const y = Math.floor(index / (sizeX * sizeZ));
      const layerIndex = index - y * sizeX * sizeZ;
      const z = Math.floor(layerIndex / sizeX);
      const x = layerIndex - z * sizeX;
      componentFacesMask |= getBoundaryFaces(x, y, z);

      for (const [dx, dy, dz] of FACE_DIRECTIONS) {
        const nextX = x + dx;
        const nextY = y + dy;
        const nextZ = z + dz;
        if (
          nextX < 0 || nextX >= sizeX
          || nextY < 0 || nextY >= sizeY
          || nextZ < 0 || nextZ >= sizeZ
        ) {
          continue;
        }

        const nextIndex = nextX + nextZ * sizeX + nextY * sizeX * sizeZ;
        if (visited[nextIndex] !== 0 || !isTransparentVoxel(nextIndex)) continue;
        visited[nextIndex] = 1;
        queue[writeIndex++] = nextIndex;
      }
    }

    openFacesMask |= componentFacesMask;
    portalMask = addComponentPortals(portalMask, componentFacesMask);
  }

  return {
    schemaVersion: CHUNK_VISIBILITY_SCHEMA_VERSION,
    chunkRevision,
    openFacesMask,
    portalMask,
  };
}

export function hasOpenFace(summary: ChunkVisibilitySummary, face: ChunkFace): boolean {
  return (summary.openFacesMask & (1 << face)) !== 0;
}

export function hasPortalConnection(
  summary: ChunkVisibilitySummary,
  firstFace: ChunkFace,
  secondFace: ChunkFace,
): boolean {
  if (firstFace === secondFace) return hasOpenFace(summary, firstFace);
  return (summary.portalMask & (1 << getPortalBitIndex(firstFace, secondFace))) !== 0;
}

export function isCurrentChunkVisibilitySummary(
  summary: ChunkVisibilitySummary | undefined,
  chunkRevision: number,
): summary is ChunkVisibilitySummary {
  return isCompatibleChunkVisibilitySummary(summary)
    && summary.chunkRevision === chunkRevision;
}

export function isCompatibleChunkVisibilitySummary(
  summary: ChunkVisibilitySummary | undefined,
): summary is ChunkVisibilitySummary {
  return summary?.schemaVersion === CHUNK_VISIBILITY_SCHEMA_VERSION;
}
