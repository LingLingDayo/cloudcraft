/**
 * 判断当前设备是否为移动端设备（手机或平板）
 * 严格基于浏览器 User Agent 标识进行判断，避免触控屏幕等硬件检测误判
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  // 针对 iPadOS 上的 Safari 浏览器（其 userAgent 默认伪装为 Macintosh）
  const isMaciPad = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;

  return isMobileUA || isMaciPad;
};

export interface FullscreenHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

export interface FullscreenDocument extends Document {
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
}

export interface SafeScreenOrientation {
  lock?: (orientation: 'any' | 'natural' | 'landscape' | 'portrait' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
  unlock?: () => void;
}

let devMode = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : false;

export const setDevModeForTesting = (val: boolean) => {
  devMode = val;
};

/**
 * 尝试让移动端设备进入横屏，再触发全屏
 */
export const requestFullscreenAndLandscape = async (element: HTMLElement = document.documentElement) => {
  if (devMode) {
    console.warn('[DEV] requestFullscreenAndLandscape bypassed in development environment');
    return;
  }
  const isMobile = isMobileDevice();

  const orientation = (typeof window !== 'undefined' && window.screen && window.screen.orientation) as unknown as SafeScreenOrientation | undefined;



  // 1. 如果是移动端，先尝试触发横屏锁定
  if (isMobile && orientation && orientation.lock) {
    try {
      await orientation.lock('landscape');
      console.log('Successfully locked orientation to landscape before fullscreen');
    } catch (err) {
      console.warn('Failed to lock orientation before fullscreen, will retry after fullscreen:', err);
    }
  }

  // 2. 触发全屏
  const el = element as FullscreenHTMLElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    }
  } catch (err) {
    console.warn('Failed to enter fullscreen:', err);
  }

  // 3. 全屏触发后再次尝试锁定横屏（对于大部分移动端浏览器，必须在全屏状态下才允许锁定屏幕方向）
  if (isMobile && orientation && orientation.lock) {
    try {
      await orientation.lock('landscape');
      console.log('Successfully locked orientation to landscape after fullscreen');
    } catch (err) {
      console.warn('Failed to lock orientation after fullscreen:', err);
    }
  }
};

/**
 * 退出全屏并解除屏幕锁定
 */
export const exitFullscreenAndUnlock = async () => {
  if (devMode) {
    console.warn('[DEV] exitFullscreenAndUnlock bypassed in development environment');
    return;
  }
  const isMobile = isMobileDevice();

  const orientation = (typeof window !== 'undefined' && window.screen && window.screen.orientation) as unknown as SafeScreenOrientation | undefined;



  // 1. 解锁屏幕方向
  if (isMobile && orientation && orientation.unlock) {
    try {
      orientation.unlock();
      console.log('Successfully unlocked orientation');
    } catch (err) {
      console.warn('Failed to unlock orientation:', err);
    }
  }

  // 2. 退出全屏
  const doc = document as FullscreenDocument;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
  } catch (err) {
    console.warn('Failed to exit fullscreen:', err);
  }
};

