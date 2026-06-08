import { describe, test, expect } from 'vitest';
import { cleanGpuName } from './gpu';

describe('cleanGpuName Utility', () => {
  test('should parse ANGLE Windows NVIDIA Dedicated GPU correctly', () => {
    const raw = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58) Direct3D11 vs_5_0 ps_5_0, D3D11)';
    expect(cleanGpuName(raw)).toBe('NVIDIA GeForce RTX 5070 Laptop GPU');
  });

  test('should parse ANGLE Windows Intel Integrated GPU correctly', () => {
    const raw = 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E9B) Direct3D11 vs_5_0 ps_5_0, D3D11)';
    expect(cleanGpuName(raw)).toBe('Intel(R) UHD Graphics 630');
  });

  test('should parse AMD GPU preserving registered trademarks correctly', () => {
    const raw = 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001636) Direct3D11 vs_5_0 ps_5_0, D3D11)';
    expect(cleanGpuName(raw)).toBe('AMD Radeon(TM) Graphics');
  });

  test('should parse macOS Apple M-Series GPUs correctly', () => {
    const raw = 'Apple M1';
    expect(cleanGpuName(raw)).toBe('Apple M1');
  });

  test('should parse OpenGL legacy format strings correctly', () => {
    const raw = 'NVIDIA GeForce GTX 1060 6GB/PCIe/SSE2';
    expect(cleanGpuName(raw)).toBe('NVIDIA GeForce GTX 1060 6GB');
  });

  test('should handle empty or null inputs gracefully', () => {
    expect(cleanGpuName('')).toBe('Unknown');
    expect(cleanGpuName(null as unknown as string)).toBe('Unknown');
  });
});
