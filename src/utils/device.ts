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
