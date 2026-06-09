import { describe, test, expect } from 'vitest';
import { ImprovedNoise } from './Noise';

describe('ImprovedNoise', () => {
  test('should generate consistent noise values for the same seed and coordinates', () => {
    const noiseGen1 = new ImprovedNoise('test-seed');
    const noiseGen2 = new ImprovedNoise('test-seed');

    const val1 = noiseGen1.noise(1.5, 2.5);
    const val2 = noiseGen2.noise(1.5, 2.5);
    
    expect(val1).toBe(val2);
  });

  test('should generate different noise values for different seeds', () => {
    const noiseGen1 = new ImprovedNoise('seed-a');
    const noiseGen2 = new ImprovedNoise('seed-b');

    const val1 = noiseGen1.noise(10.5, 20.5);
    const val2 = noiseGen2.noise(10.5, 20.5);

    expect(val1).not.toBe(val2);
  });

  test('should compute fbm within reasonable range', () => {
    const noiseGen = new ImprovedNoise('cloudcraft');
    
    // Test multiple sample coordinates
    for (let x = 0; x < 100; x += 10) {
      for (let y = 0; y < 100; y += 10) {
        const val = noiseGen.fbm(x * 0.05, y * 0.05, 4, 0.5);
        // Normalized Perlin noise fbm should be bounded
        expect(val).toBeGreaterThanOrEqual(-2.0);
        expect(val).toBeLessThanOrEqual(2.0);
      }
    }
  });

  test('should seed correctly when initialized with number seed', () => {
    const noiseGen1 = new ImprovedNoise(12345);
    const noiseGen2 = new ImprovedNoise('12345');

    expect(noiseGen1.noise(0.5, 0.5)).toBe(noiseGen2.noise(0.5, 0.5));
  });

  test('should generate consistent 3D noise values and vary by seed', () => {
    const genA1 = new ImprovedNoise('seed-a');
    const genA2 = new ImprovedNoise('seed-a');
    const genB = new ImprovedNoise('seed-b');

    const valA1 = genA1.noise3d(1.1, 2.2, 3.3);
    const valA2 = genA2.noise3d(1.1, 2.2, 3.3);
    const valB = genB.noise3d(1.1, 2.2, 3.3);

    expect(valA1).toBe(valA2);
    expect(valA1).not.toBe(valB);

    // Check bound ranges over sample points
    for (let x = 0; x < 20; x += 5) {
      for (let y = 0; y < 20; y += 5) {
        for (let z = 0; z < 20; z += 5) {
          const val = genA1.noise3d(x * 0.1, y * 0.1, z * 0.1);
          expect(val).toBeGreaterThanOrEqual(-1.5);
          expect(val).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });
});
