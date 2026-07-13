import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import {
  getFixtureOrientationFromDirection,
  resolveWorldInteractionTarget,
} from './WorldInteractionTarget';

const voxelHit = {
  target: new THREE.Vector3(0, 0, 4),
  place: new THREE.Vector3(0, 0, 3),
  face: new THREE.Vector3(0, 0, -1),
  blockId: 1,
};

const createFixtureHit = (distance: number) => ({
  fixtureId: 'fixture-nearby',
  distance,
  point: new THREE.Vector3(0.5, 0.5, distance),
  object: new THREE.Object3D(),
});

describe('resolveWorldInteractionTarget', () => {
  test('selects a fixture that is nearer than the voxel entry plane', () => {
    const target = resolveWorldInteractionTarget(
      new THREE.Vector3(0.5, 0.5, 0.5),
      new THREE.Vector3(0, 0, 1),
      voxelHit,
      createFixtureHit(2.5),
    );

    expect(target?.kind).toBe('fixture');
  });

  test('keeps the voxel target when its entry plane is nearer', () => {
    const target = resolveWorldInteractionTarget(
      new THREE.Vector3(0.5, 0.5, 0.5),
      new THREE.Vector3(0, 0, 1),
      voxelHit,
      createFixtureHit(4),
    );

    expect(target).toMatchObject({ kind: 'voxel', distance: 3.5 });
  });
});

describe('getFixtureOrientationFromDirection', () => {
  test('faces a placed fixture back toward the player view', () => {
    expect(getFixtureOrientationFromDirection(new THREE.Vector3(0, 0, 1))).toBe(2);
    expect(getFixtureOrientationFromDirection(new THREE.Vector3(-1, 0, 0))).toBe(1);
  });
});
