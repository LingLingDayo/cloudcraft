import type * as THREE from 'three';
import type {
  FixtureOrientation,
  FixtureRaycastHit,
} from '@game/fixtures/FixtureTypes';

export interface VoxelInteractionHit {
  readonly target: THREE.Vector3;
  readonly place: THREE.Vector3;
  readonly face: THREE.Vector3;
  readonly blockId: number;
}

export type WorldInteractionTarget =
  | {
    readonly kind: 'voxel';
    readonly distance: number;
    readonly hit: VoxelInteractionHit;
  }
  | {
    readonly kind: 'fixture';
    readonly distance: number;
    readonly hit: FixtureRaycastHit;
  };

function getVoxelEntryDistance(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  hit: VoxelInteractionHit,
): number {
  const directionLength = direction.length();
  if (directionLength === 0 || hit.face.lengthSq() === 0) return 0;

  if (hit.face.x !== 0) {
    const boundary = hit.face.x < 0 ? hit.target.x : hit.target.x + 1;
    return Math.max(0, (boundary - origin.x) / (direction.x / directionLength));
  }
  if (hit.face.y !== 0) {
    const boundary = hit.face.y < 0 ? hit.target.y : hit.target.y + 1;
    return Math.max(0, (boundary - origin.y) / (direction.y / directionLength));
  }

  const boundary = hit.face.z < 0 ? hit.target.z : hit.target.z + 1;
  return Math.max(0, (boundary - origin.z) / (direction.z / directionLength));
}

export function resolveWorldInteractionTarget(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  voxelHit: VoxelInteractionHit | null,
  fixtureHit: FixtureRaycastHit | null,
): WorldInteractionTarget | null {
  const voxelDistance = voxelHit
    ? getVoxelEntryDistance(origin, direction, voxelHit)
    : Number.POSITIVE_INFINITY;

  if (fixtureHit && fixtureHit.distance < voxelDistance) {
    return {
      kind: 'fixture',
      distance: fixtureHit.distance,
      hit: fixtureHit,
    };
  }
  if (voxelHit) {
    return { kind: 'voxel', distance: voxelDistance, hit: voxelHit };
  }
  return fixtureHit
    ? { kind: 'fixture', distance: fixtureHit.distance, hit: fixtureHit }
    : null;
}

export function getFixtureOrientationFromDirection(
  direction: THREE.Vector3,
): FixtureOrientation {
  if (Math.abs(direction.x) < Number.EPSILON && Math.abs(direction.z) < Number.EPSILON) {
    return 0;
  }
  const facingQuarterTurn = Math.round(Math.atan2(direction.x, direction.z) / (Math.PI * 0.5));
  return ((facingQuarterTurn + 2 + 4) % 4) as FixtureOrientation;
}
