import { describe, test, expect } from 'vitest';
import { ImprovedNoise } from './Noise';
import { WaterConnectionSolver } from './WaterConnectionSolver';

describe('WaterConnectionSolver', () => {
  const noise = new ImprovedNoise('test-seed-water');
  const waterLevel = 150;

  test('should return true if starting position is directly inside natural ocean', () => {
    const result = WaterConnectionSolver.isConnectedToNaturalWater(
      0, 0,
      {
        noise,
        waterLevel,
        oceanThreshold: 2.0, // Make threshold high so any coordinate falls into ocean
        maxDepth: 5
      },
      () => 140,
      () => 0.0
    );
    expect(result).toBe(true);
  });

  test('should return true if starting position is directly inside natural river', () => {
    const result = WaterConnectionSolver.isConnectedToNaturalWater(
      0, 0,
      {
        noise,
        waterLevel,
        oceanThreshold: -1.0, // Ensure it never matches ocean
        maxDepth: 5
      },
      () => 140,
      () => 0.8 // Matches river
    );
    expect(result).toBe(true);
  });

  test('should propagate and return true if a path to water exists under water level', () => {
    // Path: (0,0) -> (1,0) -> (2,0) is below water level (140 < 150)
    // (2,0) has riverWeight = 0.8 which matches natural river.
    // Other positions are blocked (> 150).
    const getRawHeight = (x: number, z: number) => {
      if ((x === 0 && z === 0) || (x === 1 && z === 0) || (x === 2 && z === 0)) {
        return 140;
      }
      return 160;
    };

    const getRiverWeight = (x: number, z: number) => {
      if (x === 2 && z === 0) {
        return 0.8;
      }
      return 0.0;
    };

    const result = WaterConnectionSolver.isConnectedToNaturalWater(
      0, 0,
      {
        noise,
        waterLevel,
        oceanThreshold: -1.0,
        maxDepth: 5
      },
      getRawHeight,
      getRiverWeight
    );
    expect(result).toBe(true);
  });

  test('should return false if blocked by high terrain', () => {
    // (0,0) is below water level (140), but neighbors are blocked (160)
    const getRawHeight = (x: number, z: number) => {
      if (x === 0 && z === 0) {
        return 140;
      }
      return 160;
    };

    const getRiverWeight = () => 0.0;

    const result = WaterConnectionSolver.isConnectedToNaturalWater(
      0, 0,
      {
        noise,
        waterLevel,
        oceanThreshold: -1.0,
        maxDepth: 5
      },
      getRawHeight,
      getRiverWeight
    );
    expect(result).toBe(false);
  });
});
