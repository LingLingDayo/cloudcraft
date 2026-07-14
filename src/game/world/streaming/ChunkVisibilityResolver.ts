import {
  CHUNK_STREAMING_CONFIG,
} from './ChunkStreamingConfig';
import {
  ChunkFace,
  hasOpenFace,
  hasPortalConnection,
  isCurrentChunkVisibilitySummary,
  type ChunkVisibilitySummary,
} from './ChunkVisibilitySummary';

export interface ChunkCoordinate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ChunkStreamingView {
  readonly position: ChunkCoordinate;
  readonly forward: ChunkCoordinate;
  readonly verticalFovRadians: number;
  readonly aspect: number;
}

export interface ChunkVisibilityState {
  readonly summary: ChunkVisibilitySummary | undefined;
  readonly revision: number;
}

export interface ChunkVisibilityResolverInput {
  readonly center: ChunkCoordinate;
  readonly radius: number;
  readonly minChunkY: number;
  readonly maxChunkYExclusive: number;
  readonly view: ChunkStreamingView | null;
  readonly positionUncertaintyRadius?: number;
  readonly directionUncertaintyRadians?: number;
  readonly allowUnknownTraversal?: boolean;
  readonly getChunkState: (key: string) => ChunkVisibilityState | undefined;
}

export interface ChunkVisibilityResult {
  readonly directVisible: ReadonlySet<string>;
  readonly active: ReadonlySet<string>;
}

interface PropagationNode extends ChunkCoordinate {
  readonly entryFace: ChunkFace | null;
}

interface ChunkDirection {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
  readonly exitFace: ChunkFace;
  readonly entryFace: ChunkFace;
}

const CHUNK_DIRECTIONS: readonly ChunkDirection[] = [
  { dx: -1, dy: 0, dz: 0, exitFace: ChunkFace.NegativeX, entryFace: ChunkFace.PositiveX },
  { dx: 1, dy: 0, dz: 0, exitFace: ChunkFace.PositiveX, entryFace: ChunkFace.NegativeX },
  { dx: 0, dy: -1, dz: 0, exitFace: ChunkFace.NegativeY, entryFace: ChunkFace.PositiveY },
  { dx: 0, dy: 1, dz: 0, exitFace: ChunkFace.PositiveY, entryFace: ChunkFace.NegativeY },
  { dx: 0, dy: 0, dz: -1, exitFace: ChunkFace.NegativeZ, entryFace: ChunkFace.PositiveZ },
  { dx: 0, dy: 0, dz: 1, exitFace: ChunkFace.PositiveZ, entryFace: ChunkFace.NegativeZ },
];

export function getChunkStreamingKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function isWithinRadius(
  coordinate: ChunkCoordinate,
  center: ChunkCoordinate,
  radius: number,
): boolean {
  const dx = coordinate.x - center.x;
  const dy = coordinate.y - center.y;
  const dz = coordinate.z - center.z;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

function isAlwaysAvailableNeighbor(coordinate: ChunkCoordinate, center: ChunkCoordinate): boolean {
  const radius = CHUNK_STREAMING_CONFIG.alwaysAvailableNeighborRadius;
  return Math.abs(coordinate.x - center.x) <= radius
    && Math.abs(coordinate.y - center.y) <= radius
    && Math.abs(coordinate.z - center.z) <= radius;
}

/** Tests the chunk sphere against independent horizontal and vertical frustum planes. */
function isInConservativeView(
  coordinate: ChunkCoordinate,
  view: ChunkStreamingView,
  positionUncertaintyRadius: number,
  directionUncertaintyRadians: number,
): boolean {
  if (
    !Number.isFinite(view.verticalFovRadians)
    || view.verticalFovRadians <= 0
    || view.verticalFovRadians >= Math.PI
    || !Number.isFinite(view.aspect)
    || view.aspect <= 0
    || !Number.isFinite(view.position.x)
    || !Number.isFinite(view.position.y)
    || !Number.isFinite(view.position.z)
  ) {
    return true;
  }

  const { x: sizeX, y: sizeY, z: sizeZ } = CHUNK_STREAMING_CONFIG.chunkSize;
  const centerX = (coordinate.x + 0.5) * sizeX;
  const centerY = (coordinate.y + 0.5) * sizeY;
  const centerZ = (coordinate.z + 0.5) * sizeZ;
  const dx = centerX - view.position.x;
  const dy = centerY - view.position.y;
  const dz = centerZ - view.position.z;
  const distanceSq = dx * dx + dy * dy + dz * dz;
  const sphereRadius = CHUNK_STREAMING_CONFIG.chunkBoundingSphereRadius
    + positionUncertaintyRadius;
  if (distanceSq <= sphereRadius * sphereRadius) return true;

  // A cached yaw/pitch bucket represents a bounded family of rotated frustum planes.
  // Relaxing each plane by its maximum chord displacement covers that family without
  // expanding nearby chunks by the worst-case render distance.
  const directionMargin = (
    Math.sqrt(distanceSq) + positionUncertaintyRadius
  ) * 2 * Math.sin(directionUncertaintyRadians / 2);
  const conservativeSphereRadius = sphereRadius + directionMargin;

  const forwardLength = Math.hypot(view.forward.x, view.forward.y, view.forward.z);
  if (
    !Number.isFinite(forwardLength)
    || forwardLength <= CHUNK_STREAMING_CONFIG.viewBasisFallbackThreshold
  ) {
    return true;
  }

  const forwardX = view.forward.x / forwardLength;
  const forwardY = view.forward.y / forwardLength;
  const forwardZ = view.forward.z / forwardLength;
  const forwardDot = dx * forwardX + dy * forwardY + dz * forwardZ;
  if (forwardDot + conservativeSphereRadius <= 0) return false;

  const verticalSlope = Math.tan(view.verticalFovRadians / 2);
  const horizontalSlope = verticalSlope * view.aspect;
  if (
    !Number.isFinite(verticalSlope)
    || verticalSlope <= 0
    || !Number.isFinite(horizontalSlope)
    || horizontalSlope <= 0
  ) {
    return true;
  }

  // forward x world-up gives a stable horizontal basis except near vertical views.
  let rightX = -forwardZ;
  let rightY = 0;
  let rightZ = forwardX;
  let rightLength = Math.hypot(rightX, rightZ);
  if (rightLength <= CHUNK_STREAMING_CONFIG.viewBasisFallbackThreshold) {
    rightX = forwardY;
    rightY = -forwardX;
    rightZ = 0;
    rightLength = Math.hypot(rightX, rightY);
  }
  if (rightLength <= CHUNK_STREAMING_CONFIG.viewBasisFallbackThreshold) return true;

  rightX /= rightLength;
  rightY /= rightLength;
  rightZ /= rightLength;
  const upX = rightY * forwardZ - rightZ * forwardY;
  const upY = rightZ * forwardX - rightX * forwardZ;
  const upZ = rightX * forwardY - rightY * forwardX;
  const rightDot = dx * rightX + dy * rightY + dz * rightZ;
  const upDot = dx * upX + dy * upY + dz * upZ;
  const horizontalMargin = conservativeSphereRadius * Math.hypot(1, horizontalSlope);
  const verticalMargin = conservativeSphereRadius * Math.hypot(1, verticalSlope);

  return Math.abs(rightDot) - forwardDot * horizontalSlope <= horizontalMargin
    && Math.abs(upDot) - forwardDot * verticalSlope <= verticalMargin;
}

function canExitChunk(
  node: PropagationNode,
  exitFace: ChunkFace,
  state: ChunkVisibilityState | undefined,
  allowUnknownTraversal: boolean,
): boolean {
  if (!state || !isCurrentChunkVisibilitySummary(state.summary, state.revision)) {
    return allowUnknownTraversal;
  }
  if (node.entryFace === null) return hasOpenFace(state.summary, exitFace);
  return hasPortalConnection(state.summary, node.entryFace, exitFace);
}

export class ChunkVisibilityResolver {
  /** Propagates portal visibility first, then adds a bounded one-chunk safety buffer. */
  public resolve(input: ChunkVisibilityResolverInput): ChunkVisibilityResult {
    const directVisible = new Set<string>();
    const active = new Set<string>();
    const visitedEntries = new Set<string>();
    const queue: PropagationNode[] = [{ ...input.center, entryFace: null }];
    const positionUncertaintyRadius = Number.isFinite(input.positionUncertaintyRadius)
      ? Math.max(0, input.positionUncertaintyRadius ?? 0)
      : 0;
    const directionUncertaintyRadians = Number.isFinite(input.directionUncertaintyRadians)
      ? Math.max(0, Math.min(Math.PI, input.directionUncertaintyRadians ?? 0))
      : 0;
    const allowUnknownTraversal = input.allowUnknownTraversal === true;
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const node = queue[queueIndex++];
      const key = getChunkStreamingKey(node.x, node.y, node.z);
      directVisible.add(key);
      const state = input.getChunkState(key);

      for (const direction of CHUNK_DIRECTIONS) {
        const coordinate = {
          x: node.x + direction.dx,
          y: node.y + direction.dy,
          z: node.z + direction.dz,
        };
        if (
          coordinate.y < input.minChunkY
          || coordinate.y >= input.maxChunkYExclusive
          || !isWithinRadius(coordinate, input.center, input.radius)
          || (
            !isAlwaysAvailableNeighbor(coordinate, input.center)
            && input.view !== null
            && !isInConservativeView(
              coordinate,
              input.view,
              positionUncertaintyRadius,
              directionUncertaintyRadians,
            )
          )
          || !canExitChunk(node, direction.exitFace, state, allowUnknownTraversal)
        ) {
          continue;
        }

        const entryKey = `${getChunkStreamingKey(
          coordinate.x,
          coordinate.y,
          coordinate.z,
        )}:${direction.entryFace}`;
        if (visitedEntries.has(entryKey)) continue;
        visitedEntries.add(entryKey);
        queue.push({ ...coordinate, entryFace: direction.entryFace });
      }
    }

    for (const key of directVisible) active.add(key);
    const maxBufferedRadius = input.radius + CHUNK_STREAMING_CONFIG.safetyBufferRadius;
    for (const key of directVisible) {
      const [x, y, z] = key.split(',').map(Number);
      for (const direction of CHUNK_DIRECTIONS) {
        const coordinate = {
          x: x + direction.dx,
          y: y + direction.dy,
          z: z + direction.dz,
        };
        if (
          coordinate.y < input.minChunkY
          || coordinate.y >= input.maxChunkYExclusive
          || !isWithinRadius(coordinate, input.center, maxBufferedRadius)
        ) {
          continue;
        }
        active.add(getChunkStreamingKey(coordinate.x, coordinate.y, coordinate.z));
      }
    }

    return { directVisible, active };
  }
}
