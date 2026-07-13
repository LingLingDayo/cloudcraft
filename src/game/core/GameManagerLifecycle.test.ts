import { describe, expect, test, vi } from 'vitest';
import { GameManager } from './GameManager';

describe('GameManager lifecycle', () => {
  test('releases runtime dependants before world and renderer resources', () => {
    const order: string[] = [];
    const manager = Object.create(GameManager.prototype) as GameManager;
    Object.assign(manager, {
      animationId: null,
      canvas: document.createElement('canvas'),
      storeBridge: { dispose: vi.fn(() => order.push('store')) },
      controls: { dispose: vi.fn(() => order.push('controls')) },
      interaction: { dispose: vi.fn(() => order.push('interaction')) },
      droppedItems: { dispose: vi.fn(() => order.push('droppedItems')) },
      animals: { dispose: vi.fn(() => order.push('animals')) },
      particles: { clear: vi.fn(() => order.push('particles')) },
      fixtures: { dispose: vi.fn(() => order.push('fixtures')) },
      environment: { dispose: vi.fn(() => order.push('environment')) },
      world: { dispose: vi.fn(() => order.push('world')) },
      renderer: { dispose: vi.fn(() => order.push('renderer')) },
    });

    GameManager.prototype.dispose.call(manager);

    expect(order).toEqual([
      'store',
      'controls',
      'interaction',
      'droppedItems',
      'animals',
      'particles',
      'fixtures',
      'environment',
      'world',
      'renderer',
    ]);
  });
});
