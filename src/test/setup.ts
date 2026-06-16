import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock AudioContext since jsdom does not support it
class MockAudioContext {
  state = 'suspended';
  currentTime = 0;
  createOscillator() {
    return {
      connect() {},
      type: 'sine',
      frequency: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        linearRampToValueAtTime() {},
      },
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      connect() {},
      gain: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        linearRampToValueAtTime() {},
      },
    };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  destination = {};
}

vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('webkitAudioContext', MockAudioContext);

// Mock HTMLCanvasElement.prototype.toDataURL to prevent jsdom from logging warnings about missing native canvas npm package
HTMLCanvasElement.prototype.toDataURL = function() {
  return '';
};

