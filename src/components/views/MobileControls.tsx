import React, { useState, useRef } from 'react';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '@i18n';
import { useGame } from '../../context/GameContext';
import { SaveManager } from '@game/systems/SaveManager';
import { GameState } from '@type';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';
import { isMobileDevice } from '@utils/device';
import { clamp } from '@utils/math';
import styles from './MobileControls.module.scss';

// Pixel Art Icons
const PixelGearIcon: React.FC = () => {
  const d = "M7,2h2v1h-2z M6,3h4v1h-4z M4,4h8v3h-8z M2,7h12v2h-12z M4,9h8v3h-8z M6,12h4v1h-4z M7,13h2v1h-2z M7,7h2v2h-2z";
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      style={{ imageRendering: 'pixelated' }}
      fillRule="evenodd"
    >
      {/* Shadow: black fill, shifted 1px down */}
      <path d={d} transform="translate(0, 1)" fill="#181818" />
      {/* Main Icon: white fill */}
      <path d={d} fill="#ffffff" />
    </svg>
  );
};

export const PixelChestIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 16 16"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Outer border & Horizontal partition & Lock border */}
    <path
      d="M2,2h12v1h-12z M2,13h12v1h-12z M2,3h1v10h-1z M13,3h1v10h-1z M2,6h12v1h-12z M7,5h2v4h-2z"
      fill="#181818"
    />
    {/* Metal Corners */}
    <path
      d="M3,3h2v1h-2z M3,4h1v1h-1z M11,3h2v1h-2z M12,4h1v1h-1z M3,12h2v1h-2z M3,11h1v1h-1z M11,12h2v1h-2z M12,11h1v1h-1z"
      fill="#4b5563"
    />
    <path
      d="M3,3h1v1h-1z M12,3h1v1h-1z M3,12h1v1h-1z M12,12h1v1h-1z"
      fill="#9ca3af"
    />
    {/* Lock / Latch */}
    <path
      d="M7,6h1v2h-1z"
      fill="#facc15"
    />
    <path
      d="M8,6h1v2h-1z"
      fill="#ca8a04"
    />
    {/* Wood Planks - Light/Highlight wood */}
    <path
      d="M5,3h6v1h-6z M3,4h9v1h-9z"
      fill="#f59e0b"
    />
    {/* Wood Planks - Medium wood */}
    <path
      d="M3,5h10v1h-10z M4,7h9v1h-9z M3,8h4v1h-4z M9,8h4v1h-4z M3,9h4v1h-4z M9,9h4v1h-4z"
      fill="#b45309"
    />
    {/* Wood Planks - Dark wood shadow */}
    <path
      d="M3,10h10v2h-10z M5,12h6v1h-6z"
      fill="#7c2d12"
    />
  </svg>
);

export const PixelDotsIcon: React.FC = () => {
  const d = "M3,7h2v2h-2z M7,7h2v2h-2z M11,7h2v2h-2z";
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      style={{ imageRendering: 'pixelated' }}
      fillRule="evenodd"
    >
      {/* Shadow: black fill, shifted 1px down */}
      <path d={d} transform="translate(0, 1)" fill="#181818" />
      {/* Main Icon: white fill */}
      <path d={d} fill="#ffffff" />
    </svg>
  );
};

const PixelSaveIcon: React.FC = () => {
  const dOuter = "M2,2h10l1,1v10h-11z M4,7h8v5h-8z M7,4h1v2h-1z M3,11h1v1h-1z";
  const dInner = "M5,9h6v1h-6z M5,11h4v1h-4z";
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      style={{ imageRendering: 'pixelated' }}
      fillRule="evenodd"
    >
      {/* Shadow: black fill, shifted 1px down */}
      <path d={dOuter} transform="translate(0, 1)" fill="#181818" />
      <path d={dInner} transform="translate(0, 1)" fill="#181818" />
      {/* Main Icon: white fill */}
      <path d={dOuter} fill="#ffffff" />
      <path d={dInner} fill="#ffffff" />
    </svg>
  );
};

const PixelQuitIcon: React.FC = () => {
  const dDoor = "M2,2h8v2h-8z M2,12h8v2h-8z M2,4h2v8h-2z";
  const dArrow = "M5,7h6v2h-6z M11,5h1v6h-1z M12,6h1v4h-1z M13,7h1v2h-1z";
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      style={{ imageRendering: 'pixelated' }}
      fillRule="evenodd"
    >
      {/* Shadow: black fill, shifted 1px down */}
      <path d={dDoor} transform="translate(0, 1)" fill="#181818" />
      <path d={dArrow} transform="translate(0, 1)" fill="#181818" />
      {/* Main Icon: white fill */}
      <path d={dDoor} fill="#ffffff" />
      <path d={dArrow} fill="#ffffff" />
    </svg>
  );
};

const PixelHamburgerIcon: React.FC = () => {
  const d = "M2,3h12v2h-12z M2,7h12v2h-12z M2,11h12v2h-12z";
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Shadow / Border bottom */}
      <path d={d} transform="translate(0, 1)" fill="#181818" />
      {/* White Bars */}
      <path d={d} fill="#ffffff" />
    </svg>
  );
};

export const MobileControls: React.FC = () => {
  const { t } = useTranslation();
  const gameInstance = useGame();

  const setGameState = useGameStore((state) => state.setGameState);
  const setIsSettingsOpen = useGameStore((state) => state.setIsSettingsOpen);
  const dpadSize = useGameStore((state) => state.dpadSize);

  const [isMobile] = useState(() => isMobileDevice());
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [activeDirections, setActiveDirections] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
    center: false,
  });

  const dpadRef = useRef<HTMLDivElement>(null);

  // 如果不是移动端，则不渲染任何控制 UI
  if (!isMobile) return null;

  // 保存游戏数据
  const handleSave = async () => {
    if (gameInstance) {
      const saveData = {
        world: gameInstance.world.saveWorld(),
        player: {
          x: gameInstance.player.position.x,
          y: gameInstance.player.position.y,
          z: gameInstance.player.position.z,
        },
        hotbar: useGameStore.getState().hotbar,
        inventory: useGameStore.getState().inventory,
        activeSlot: useGameStore.getState().activeSlot,
        gameMode: useGameStore.getState().gameMode,
        version: SaveManager.GAME_VERSION,
      };
      try {
        await SaveManager.saveGame('default_world', saveData, t('startMenu.defaultWorldName'));
      } catch (err) {
        console.error('Failed to save game data:', err);
      }
    }
  };

  // 退出游戏
  const handleQuit = async () => {
    await handleSave();
    setGameState(GameState.MENU);
  };

  // D-pad 触摸事件（3x3 九宫格 D-pad 风格）
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

    // 使用 clamp 限制触控范围
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

    // 同步状态到 HotkeyManager 触发物理层角色移动
    hotkeyManager.setActionPressed(GameAction.MOVE_FORWARD, up);
    hotkeyManager.setActionPressed(GameAction.MOVE_BACKWARD, down);
    hotkeyManager.setActionPressed(GameAction.MOVE_LEFT, left);
    hotkeyManager.setActionPressed(GameAction.MOVE_RIGHT, right);
    hotkeyManager.setActionPressed(GameAction.JUMP, center);
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
      hotkeyManager.setActionPressed(GameAction.JUMP, false);
    } else {
      // 如果仍有手指在屏幕上，则重新评估触控坐标
      handleDpadTouch(e);
    }
  };

  return (
    <>
      {/* 移动端右上角折叠工具栏 */}
      <div className={`${styles.mobileToolbarContainer} ${toolbarExpanded ? styles.expanded : ''}`}>
        <button 
          className={`${styles.toolbarToggleBtn} glass-panel`}
          onClick={() => setToolbarExpanded(!toolbarExpanded)}
          title={toolbarExpanded ? "Close Menu" : "Open Menu"}
        >
          <PixelHamburgerIcon />
        </button>
        
        <div className={styles.toolbarMenu}>
          <button 
            className={`${styles.toolbarBtn} glass-panel`} 
            onClick={() => {
              setIsSettingsOpen(false);
              setGameState(GameState.PAUSED);
              setToolbarExpanded(false);
            }}
            title={t('settings.title')}
          >
            <PixelGearIcon />
          </button>

          <button 
            className={`${styles.toolbarBtn} glass-panel`} 
            onClick={() => {
              handleSave();
              setToolbarExpanded(false);
            }}
            title={t('pauseMenu.save')}
          >
            <PixelSaveIcon />
          </button>
          <button 
            className={`${styles.toolbarBtn} ${styles.danger} glass-panel`} 
            onClick={handleQuit}
            title={t('pauseMenu.quit')}
          >
            <PixelQuitIcon />
          </button>
        </div>
      </div>

      {/* 移动端左下角方向 D-pad 控制 */}
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
            <span className={styles.centerIcon}>●</span>
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
    </>
  );
};
