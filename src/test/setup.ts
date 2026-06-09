import '@testing-library/jest-dom';

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

Object.defineProperty(window, 'AudioContext', {
  value: MockAudioContext,
  writable: true,
});

Object.defineProperty(window, 'webkitAudioContext', {
  value: MockAudioContext,
  writable: true,
});

// Mock HTMLCanvasElement.prototype.toDataURL to prevent jsdom from logging warnings about missing native canvas npm package
HTMLCanvasElement.prototype.toDataURL = function() {
  return '';
};

