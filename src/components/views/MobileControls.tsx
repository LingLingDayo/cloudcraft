import React, { useState } from 'react';
import { isMobileDevice } from '@utils/device';
import { MobileToolbar } from './MobileToolbar';
import { MobileDpad } from './MobileDpad';
import { MobileJumpButton } from './MobileJumpButton';

// Re-export specific icons for compatibility with other views (e.g., HUD.tsx)
export { PixelDotsIcon, PixelChestIcon } from '@components/common/PixelIcons';

export const MobileControls: React.FC = () => {
  const [isMobile] = useState(() => isMobileDevice());

  // 如果不是移动端，则不渲染任何控制 UI
  if (!isMobile) return null;

  return (
    <>
      {/* 移动端右上角折叠工具栏 */}
      <MobileToolbar />

      {/* 移动端左下角方向 D-pad 控制 */}
      <MobileDpad />

      {/* 移动端右下角跳跃控制 */}
      <MobileJumpButton />
    </>
  );
};
