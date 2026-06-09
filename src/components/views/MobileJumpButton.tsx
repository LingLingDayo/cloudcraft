import React, { useState } from 'react';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';
import { PixelSolidDiamondIcon } from '@components/common/PixelIcons';
import styles from './MobileControls.module.scss';

export const MobileJumpButton: React.FC = () => {
  const [isJumpActive, setIsJumpActive] = useState(false);

  const handleJumpTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsJumpActive(true);
    hotkeyManager.setActionPressed(GameAction.JUMP, true);
  };

  const handleJumpTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsJumpActive(false);
    hotkeyManager.setActionPressed(GameAction.JUMP, false);
  };

  return (
    <div 
      className={styles.jumpContainer}
      onTouchStart={handleJumpTouchStart}
      onTouchEnd={handleJumpTouchEnd}
      onTouchCancel={handleJumpTouchEnd}
    >
      <div className={`${styles.jumpBtn} ${isJumpActive ? styles.active : ''}`} title="Jump">
        <PixelSolidDiamondIcon />
      </div>
    </div>
  );
};
