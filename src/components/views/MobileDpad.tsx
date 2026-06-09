import React, { useState, useRef } from 'react';
import { useGameStore } from '@store/useGameStore';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';
import { clamp } from '@utils/math';
import { PixelHollowDiamondIcon } from '@components/common/PixelIcons';
import styles from './MobileControls.module.scss';

export const MobileDpad: React.FC = () => {
  const dpadSize = useGameStore((state) => state.dpadSize);

  const [activeDirections, setActiveDirections] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
    center: false,
  });

  const dpadRef = useRef<HTMLDivElement>(null);
  const prevUpRef = useRef<boolean>(false);
  const lastUpTimeRef = useRef<number>(0);
  const isDoubleTapSprintingRef = useRef<boolean>(false);

  const handleDpadTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.cancelable) {
      e.preventDefault();
    }

    if (!dpadRef.current) return;

    const touch = e.targetTouches[0];
    if (!touch) return;

    const rect = dpadRef.current.getBoundingClientRect();
    const rx = touch.clientX - rect.left;
    const ry = touch.clientY - rect.top;

    const x = clamp(rx, 0, rect.width);
    const y = clamp(ry, 0, rect.height);

    const xIndex = Math.floor((x / rect.width) * 3);
    const yIndex = Math.floor((y / rect.height) * 3);

    let up = false;
    let down = false;
    let left = false;
    let right = false;
    let center = false;

    if (xIndex === 1 && yIndex === 0) up = true;
    else if (xIndex === 1 && yIndex === 2) down = true;
    else if (xIndex === 0 && yIndex === 1) left = true;
    else if (xIndex === 2 && yIndex === 1) right = true;
    else if (xIndex === 1 && yIndex === 1) center = true;

    setActiveDirections({ up, down, left, right, center });

    const now = Date.now();
    if (up && !prevUpRef.current) {
      if (now - lastUpTimeRef.current < 300) {
        isDoubleTapSprintingRef.current = true;
        hotkeyManager.setActionPressed(GameAction.SNEAK, true);
      } else {
        if (isDoubleTapSprintingRef.current) {
          isDoubleTapSprintingRef.current = false;
          hotkeyManager.setActionPressed(GameAction.SNEAK, false);
        }
      }
      lastUpTimeRef.current = now;
    } else if (!up && prevUpRef.current) {
      if (isDoubleTapSprintingRef.current) {
        isDoubleTapSprintingRef.current = false;
        hotkeyManager.setActionPressed(GameAction.SNEAK, false);
      }
    }
    prevUpRef.current = up;

    hotkeyManager.setActionPressed(GameAction.MOVE_FORWARD, up);
    hotkeyManager.setActionPressed(GameAction.MOVE_BACKWARD, down);
    hotkeyManager.setActionPressed(GameAction.MOVE_LEFT, left);
    hotkeyManager.setActionPressed(GameAction.MOVE_RIGHT, right);
  };

  const handleDpadTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (e.targetTouches.length === 0) {
      setActiveDirections({
        up: false,
        down: false,
        left: false,
        right: false,
        center: false,
      });

      hotkeyManager.setActionPressed(GameAction.MOVE_FORWARD, false);
      hotkeyManager.setActionPressed(GameAction.MOVE_BACKWARD, false);
      hotkeyManager.setActionPressed(GameAction.MOVE_LEFT, false);
      hotkeyManager.setActionPressed(GameAction.MOVE_RIGHT, false);

      prevUpRef.current = false;
      if (isDoubleTapSprintingRef.current) {
        isDoubleTapSprintingRef.current = false;
        hotkeyManager.setActionPressed(GameAction.SNEAK, false);
      }
    } else {
      handleDpadTouch(e);
    }
  };

  return (
    <div 
      className={styles.dpadContainer}
      onTouchStart={handleDpadTouch}
      onTouchMove={handleDpadTouch}
      onTouchEnd={handleDpadTouchEnd}
      onTouchCancel={handleDpadTouchEnd}
    >
      <div 
        className={styles.dpad} 
        ref={dpadRef}
        style={{
          '--dpad-size': `${dpadSize}px`
        } as React.CSSProperties}
      >
        <div className={styles.dpadEmpty} />
        <div className={`${styles.dpadBtn} ${styles.up} ${activeDirections.up ? styles.active : ''}`}>
          <span className={styles.arrowIcon}>▲</span>
        </div>
        <div className={styles.dpadEmpty} />

        <div className={`${styles.dpadBtn} ${styles.left} ${activeDirections.left ? styles.active : ''}`}>
          <span className={styles.arrowIcon}>◀</span>
        </div>
        <div className={`${styles.dpadBtn} ${styles.center} ${activeDirections.center ? styles.active : ''}`}>
          <PixelHollowDiamondIcon />
        </div>
        <div className={`${styles.dpadBtn} ${styles.right} ${activeDirections.right ? styles.active : ''}`}>
          <span className={styles.arrowIcon}>▶</span>
        </div>

        <div className={styles.dpadEmpty} />
        <div className={`${styles.dpadBtn} ${styles.down} ${activeDirections.down ? styles.active : ''}`}>
          <span className={styles.arrowIcon}>▼</span>
        </div>
        <div className={styles.dpadEmpty} />
      </div>
    </div>
  );
};
