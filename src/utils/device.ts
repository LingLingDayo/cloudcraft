import variables from '@styles/variables.module.scss';

let cachedIsMobile: boolean | null = null;

const checkIsMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  // 针对 iPadOS 上的 Safari 浏览器（其 userAgent 默认伪装为 Macintosh）
  const isMaciPad = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;

  // 页面宽度小于 variables.breakpointMobile (默认 1024px) 判定为移动端
  const parsedBreakpoint = parseInt(variables?.breakpointMobile, 10);
  const breakpoint = isNaN(parsedBreakpoint) ? 1024 : parsedBreakpoint;
  const isSmallScreen = window.innerWidth < breakpoint;

  return isMobileUA || isMaciPad || isSmallScreen;
};

// 监听窗口大小变化以更新缓存值
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    cachedIsMobile = checkIsMobile();
  });
}

/**
 * 判断当前设备是否为移动端设备（手机或平板）
 * 结合浏览器 User Agent 标识与页面宽度进行判断，满足任意一个即判定为移动端。
 * 使用缓存和 resize 监听器进行优化，以防在渲染 Tick 循环中高频重复计算带来的性能开销。
 */
export const isMobileDevice = (): boolean => {
  if (cachedIsMobile === null) {
    cachedIsMobile = checkIsMobile();
  }
  return cachedIsMobile;
};

/**
 * 获取设备的真实类型
 * 仅通过设备标识（User Agent 及特定触控属性）来判断，排除了屏幕宽度的判定。
 * @returns 'mobile' | 'desktop'
 */
export const getRealDeviceType = (): 'mobile' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  // 针对 iPadOS 上的 Safari 浏览器（其 userAgent 默认伪装为 Macintosh）
  const isMaciPad = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;

  return (isMobileUA || isMaciPad) ? 'mobile' : 'desktop';
};

/**
 * 清除移动端状态的缓存，仅供单元测试使用
 */
export const clearCacheForTesting = () => {
  cachedIsMobile = null;
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

/**
 * 尝试让移动端设备进入横屏，再触发全屏
 */
export const requestFullscreenAndLandscape = async (element: HTMLElement = document.documentElement) => {
  const isMobile = getRealDeviceType() === 'mobile';

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
  const isMobile = getRealDeviceType() === 'mobile';

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

