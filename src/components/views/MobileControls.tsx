import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '../../i18n';
import { useGame } from '../../context/GameContext';
import { SaveManager } from '@game/systems/SaveManager';
import { GameState } from '@type';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';
import { isMobileDevice } from '../../utils/device';
import { clamp } from '../../utils/math';
import styles from './MobileControls.module.scss';

// Pixel Art Icons
const PixelGearIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 16 16"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Outline / Border */}
    <path
      d="M7,0h2v1h-2z M6,1h1v2h-1z M9,1h1v2h-1z M2,2h2v1h-2z M2,3h1v1h-1z M12,2h2v1h-2z M13,3h1v1h-1z M2,13h2v1h-2z M2,12h1v1h-1z M12,13h2v1h-2z M13,12h1v1h-1z M7,15h2v1h-2z M6,13h1v2h-1z M9,13h1v2h-1z M0,7h1v2h-1z M1,6h2v1h-2z M1,9h2v1h-2z M15,7h1v2h-1z M13,6h2v1h-2z M13,9h2v1h-2z M5,2h1v1h-1z M10,2h1v1h-1z M4,3h1v1h-1z M11,3h1v1h-1z M3,4h1v1h-1z M12,4h1v1h-1z M2,5h1v1h-1z M13,5h1v1h-1z M2,10h1v1h-1z M13,10h1v1h-1z M3,11h1v1h-1z M12,11h1v1h-1z M4,12h1v1h-1z M11,12h1v1h-1z M5,13h1v1h-1z M10,13h1v1h-1z M6,6h4v1h-4z M6,9h4v1h-4z M6,7h1v2h-1z M9,7h1v2h-1z"
      fill="#1a1a1a"
    />
    {/* Highlights (top-left facing) */}
    <path
      d="M7,1h1v2h-1z M3,3h1v1h-1z M4,4h1v1h-1z M1,7h1v1h-1z M2,7h1v1h-1z M5,4h2v1h-2z M4,5h2v1h-2z M3,6h2v1h-2z M5,5h2v1h-2z M5,6h1v1h-1z M7,5h1v1h-1z M7,6h1v1h-1z"
      fill="#ffffff"
    />
    {/* Shadows (bottom-right facing) */}
    <path
      d="M8,13h1v2h-1z M12,12h1v1h-1z M11,11h1v1h-1z M14,8h1v1h-1z M13,8h1v1h-1z M9,11h2v1h-2z M10,10h2v1h-2z M11,9h2v1h-2z M9,9h2v1h-2z M10,9h1v1h-1z M8,10h1v1h-1z"
      fill="#4b5563"
    />
    {/* Base Metal */}
    <path
      d="M8,1h1v2h-1z M11,3h1v1h-1z M12,3h1v1h-1z M13,7h1v1h-1z M12,8h1v1h-1z M12,11h1v1h-1z M11,12h1v1h-1z M7,13h1v1h-1z M3,12h1v1h-1z M3,11h1v1h-1z M2,8h1v1h-1z M1,8h1v1h-1z M7,3h1v2h-1z M8,3h2v1h-2z M9,4h2v1h-2z M10,5h2v1h-2z M11,7h2v2h-2z M9,10h1v1h-1z M8,9h1v1h-1z M4,7h2v2h-2z M3,8h1v1h-1z M3,9h2v1h-2z"
      fill="#9ca3af"
    />
  </svg>
);

const PixelChestIcon: React.FC = () => (
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

const PixelSaveIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 16 16"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Disk Outline & Components Borders */}
    <path
      d="M2,2h10v1h-10z M12,3h1v1h-1z M13,4h1v10h-1z M2,14h12v1h-12z M2,3h1v11h-1z M5,2h5v4h-5z M4,8h8v6h-8z"
      fill="#181818"
    />
    {/* Metal Shutter */}
    <path
      d="M5,3h4v1h-4z M5,4h2v1h-2z M5,5h4v1h-4z"
      fill="#d1d5db"
    />
    <path
      d="M8,4h1v2h-1z"
      fill="#9ca3af"
    />
    {/* White Label */}
    <path
      d="M4,9h8v4h-8z"
      fill="#f3f4f6"
    />
    {/* Label lines (red) */}
    <path
      d="M5,10h6v1h-6z M5,12h6v1h-6z"
      fill="#ef4444"
    />
    {/* Casing Highlight (blue) */}
    <path
      d="M3,3h2v5h-2z M10,3h2v1h-2z M12,4h1v4h-1z M3,8h1v6h-1z"
      fill="#3b82f6"
    />
    {/* Casing Shadow (dark blue) */}
    <path
      d="M12,8h1v6h-1z M4,13h8v1h-8z"
      fill="#1d4ed8"
    />
  </svg>
);

const PixelQuitIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 16 16"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Door outline & Exit Arrow outline */}
    <path
      d="M2,1h7v14h-7z M8,8h5v1h-5z M8,10h5v1h-5z M12,7h1v1h-1z M13,6h1v1h-1z M14,7h1v3h-1z M13,10h1v1h-1z M12,9h1v1h-1z"
      fill="#181818"
    />
    {/* Sky Window inside door */}
    <path
      d="M4,4h2v2h-2z"
      fill="#38bdf8"
    />
    <path
      d="M4,4h1v1h-1z"
      fill="#ffffff"
    />
    {/* Window Frame */}
    <path
      d="M3,3h4v1h-4z M3,7h4v1h-4z M3,4h1v3h-1z M6,4h1v3h-1z"
      fill="#181818"
    />
    {/* Door wood panels - Highlight */}
    <path
      d="M3,2h5v1h-5z M3,7h4v1h-4z"
      fill="#f59e0b"
    />
    {/* Door wood panels - Medium wood */}
    <path
      d="M3,8h4v6h-4z"
      fill="#b45309"
    />
    {/* Door wood panels - Dark wood shadow & Gold handle */}
    <path
      d="M7,8h1v6h-1z"
      fill="#7c2d12"
    />
    <path
      d="M7,8h1v1h-1z"
      fill="#facc15"
    />
    {/* Exit Arrow - Green body */}
    <path
      d="M8,9h4v1h-4z"
      fill="#86efac"
    />
    <path
      d="M8,10h4v1h-4z"
      fill="#16a34a"
    />
    <path
      d="M12,8h1v1h-1z M13,7h1v3h-1z M12,10h1v1h-1z"
      fill="#22c55e"
    />
  </svg>
);

const PixelHamburgerIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 16 16"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* 3 Horizontal bars borders */}
    <path
      d="M2,2h12v3h-12z M2,6h12v3h-12z M2,10h12v3h-12z"
      fill="#181818"
    />
    {/* Shiny Metal highlights */}
    <path
      d="M3,3h2v1h-2z M3,7h2v1h-2z M3,11h2v1h-2z"
      fill="#f3f4f6"
    />
    {/* Shiny Metal midtones */}
    <path
      d="M5,3h6v1h-6z M5,7h6v1h-6z M5,11h6v1h-6z"
      fill="#9ca3af"
    />
    {/* Shiny Metal shadows */}
    <path
      d="M11,3h2v1h-2z M11,7h2v1h-2z M11,11h2v1h-2z"
      fill="#4b5563"
    />
  </svg>
);

export const MobileControls: React.FC = () => {
  const { t } = useTranslation();
  const gameInstance = useGame();

  const setGameState = useGameStore((state) => state.setGameState);
  const setIsSettingsOpen = useGameStore((state) => state.setIsSettingsOpen);

  const [isMobile, setIsMobile] = useState(false);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [activeDirections, setActiveDirections] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
    center: false,
  });

  const dpadRef = useRef<HTMLDivElement>(null);

  // 监听窗口大小变化以更新移动端环境状态
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(isMobileDevice());
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
              useGameStore.getState().toggleInventory();
              setToolbarExpanded(false);
            }}
            title={t('controls.openInventory')}
          >
            <PixelChestIcon />
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
        <div className={styles.dpad} ref={dpadRef}>
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
