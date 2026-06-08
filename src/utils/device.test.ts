import { describe, test, expect, afterEach, beforeEach, vi, type Mock } from 'vitest';
import { isMobileDevice, getRealDeviceType, requestFullscreenAndLandscape, exitFullscreenAndUnlock, clearCacheForTesting } from './device';

describe('isMobileDevice', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    // Default to a desktop width of 1024 (so width check alone is false)
    Object.defineProperty(window, 'innerWidth', {
      get: () => 1024,
      configurable: true,
    });
    clearCacheForTesting();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });
    // Delete override to restore the original window.innerWidth getter
    delete (window as { innerWidth?: number }).innerWidth;
    clearCacheForTesting();
  });

  test('should return true for Android user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36',
      configurable: true,
    });
    expect(isMobileDevice()).toBe(true);
  });

  test('should return true for iPhone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    expect(isMobileDevice()).toBe(true);
  });

  test('should return true for iPadOS Safari (prefers desktop site, reports Mac, has touch points)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    });
    expect(isMobileDevice()).toBe(true);
  });

  test('should return false for macOS Safari (reports Mac, has no touch points)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });
    expect(isMobileDevice()).toBe(false);
  });

  test('should return false for desktop Windows Chrome', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      configurable: true,
    });
    expect(isMobileDevice()).toBe(false);
  });

  test('should return true for small screen width in development mode even if user agent is desktop', () => {
    Object.defineProperty(window, 'innerWidth', {
      get: () => 800,
      configurable: true,
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      configurable: true,
    });
    expect(isMobileDevice()).toBe(true);
  });

  test('should return true for small screen width in production mode if user agent is desktop', () => {
    Object.defineProperty(window, 'innerWidth', {
      get: () => 800,
      configurable: true,
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      configurable: true,
    });
    expect(isMobileDevice()).toBe(true);
  });
});

describe('getRealDeviceType', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    // 设置一个较小的屏幕宽度，以测试该方法是否确实忽略了宽度
    Object.defineProperty(window, 'innerWidth', {
      get: () => 500,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });
    delete (window as { innerWidth?: number }).innerWidth;
  });

  test('should return mobile for Android user agent even with small screen', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36',
      configurable: true,
    });
    expect(getRealDeviceType()).toBe('mobile');
  });

  test('should return mobile for iPhone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    expect(getRealDeviceType()).toBe('mobile');
  });

  test('should return desktop for desktop Windows Chrome even on small screens', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      configurable: true,
    });
    expect(getRealDeviceType()).toBe('desktop');
  });

  test('should return mobile for iPadOS Safari with touch points', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    });
    expect(getRealDeviceType()).toBe('mobile');
  });
});

describe('fullscreen and orientation lock helpers', () => {
  let requestFullscreenMock: Mock;
  let exitFullscreenMock: Mock;
  let lockMock: Mock;
  let unlockMock: Mock;
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
    exitFullscreenMock = vi.fn().mockResolvedValue(undefined);
    lockMock = vi.fn().mockResolvedValue(undefined);
    unlockMock = vi.fn().mockResolvedValue(undefined);
    clearCacheForTesting();

    // Mock document element methods
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreenMock,
      configurable: true,
      writable: true,
    });

    // Mock document methods
    Object.defineProperty(document, 'exitFullscreen', {
      value: exitFullscreenMock,
      configurable: true,
      writable: true,
    });

    // Mock screen orientation
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'screen', {
        value: {
          orientation: {
            lock: lockMock,
            unlock: unlockMock,
          },
        },
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    vi.restoreAllMocks();
    clearCacheForTesting();
  });

  test('should lock orientation and request fullscreen for mobile device', async () => {
    // Mock mobile device
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    await requestFullscreenAndLandscape(document.documentElement);

    // Should lock to landscape before & after fullscreen
    expect(lockMock).toHaveBeenCalledWith('landscape');
    expect(lockMock).toHaveBeenCalledTimes(2);
    expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
  });

  test('should not lock orientation for desktop device', async () => {
    // Mock desktop device
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      configurable: true,
    });

    await requestFullscreenAndLandscape(document.documentElement);

    expect(lockMock).not.toHaveBeenCalled();
    expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
  });

  test('should unlock orientation and exit fullscreen on exit', async () => {
    // Mock mobile device
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    await exitFullscreenAndUnlock();

    expect(unlockMock).toHaveBeenCalledTimes(1);
    expect(exitFullscreenMock).toHaveBeenCalledTimes(1);
  });
});


