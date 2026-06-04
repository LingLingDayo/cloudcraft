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
    <path
      d="M7,2h2v2h-2z M7,12h2v2h-2z M2,7h2v2h-2z M12,7h2v2h-2z M3,3h1v1h-1z M4,4h1v1h-1z M12,3h1v1h-1z M11,4h1v1h-1z M3,12h1v1h-1z M4,11h1v1h-1z M12,12h1v1h-1z M11,11h1v1h-1z M6,4h4v1h-4z M4,6h1v4h-1z M11,6h1v4h-1z M6,11h4v1h-4z M5,5h1v1h-1z M10,5h1v1h-1z M5,10h1v1h-1z M10,10h1v1h-1z"
      fill="#212121"
    />
    <path
      d="M7,6h2v1h-2z M7,9h2v1h-2z M6,7h1v2h-1z M9,7h1v2h-1z"
      fill="#212121"
    />
    <path
      d="M7,3h2v1h-2z M7,12h2v1h-2z M3,7h1v2h-1z M12,7h1v2h-1z M4,4h1v1h-1z M11,4h1v1h-1z M4,11h1v1h-1z M11,11h1v1h-1z M6,5h4v1h-4z M5,6h6v1h-6z M4,7h2v2h-2z M10,7h2v2h-2z M5,9h6v1h-6z M6,10h4v1h-4z"
      fill="#aaaaaa"
    />
    <path
      d="M7,3h1v1h-1z M4,4h1v1h-1z M6,5h2v1h-2z M5,6h1v1h-1z M3,7h1v1h-1z M4,7h1v1h-1z M7,6h1v1h-1z M6,7h1v2h-1z"
      fill="#ffffff"
    />
    <path
      d="M8,3h1v1h-1z M11,4h1v1h-1z M9,5h1v1h-1z M10,6h1v1h-1z M12,8h1v1h-1z M11,8h1v1h-1z M8,9h1v1h-1z M9,7h1v2h-1z M8,10h2v1h-2z M8,12h1v1h-1z M11,11h1v1h-1z M4,11h1v1h-1z"
      fill="#555555"
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
    <path
      d="M2,2h12v1h-12z M2,13h12v1h-12z M2,3h1v10h-1z M13,3h1v10h-1z M3,7h10v1h-10z M7,6h2v3h-2z"
      fill="#212121"
    />
    <path
      d="M3,3h10v3h-10z M3,6h4v1h-4z M9,6h4v1h-4z"
      fill="#d97d4b"
    />
    <path
      d="M3,8h4v5h-4z M9,8h4v5h-4z M7,9h2v4h-2z"
      fill="#a0522d"
    />
    <path
      d="M7,7h2v2h-2z"
      fill="#ffcc00"
    />
    <path
      d="M8,8h1v1h-1z"
      fill="#b35d32"
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
    <path
      d="M2,2h11v1h-11z M13,3h1v1h-1z M14,4h1v10h-1z M2,14h12v1h-12z M2,3h1v11h-1z M4,8h8v6h-8z M5,2h5v4h-5z"
      fill="#212121"
    />
    <path
      d="M3,3h2v4h-2z M10,3h3v1h-3z M10,4h4v3h-4z M3,7h11v1h-11z M3,8h1v6h-1z M12,8h2v6h-2z M4,13h8v1h-8z"
      fill="#3c5e8a"
    />
    <path
      d="M5,3h5v3h-5z"
      fill="#c6c6c6"
    />
    <path
      d="M6,3h1v2h-1z"
      fill="#7e7e7e"
    />
    <path
      d="M5,9h6v4h-6z"
      fill="#f3f3f3"
    />
    <path
      d="M6,10h4v1h-4z M6,12h4v1h-4z"
      fill="#ff4d4d"
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
    <path
      d="M3,1h8v1h-8z M11,2h1v13h-1z M3,15h8v1h-8z M3,2h1v13h-1z M5,3h4v4h-4z M9,8h1v2h-1z"
      fill="#212121"
    />
    <path
      d="M4,2h7v1h-7z M4,3h1v4h-1z M9,3h2v4h-2z M4,7h7v1h-7z M4,8h5v7h-5z M9,10h2v5h-2z M10,8h1v2h-1z"
      fill="#c48a52"
    />
    <path
      d="M5,4h4v3h-4z"
      fill="#8bc5ff"
    />
    <path
      d="M5,4h2v1h-2z"
      fill="#ffffff"
    />
    <path
      d="M9,9h1v1h-1z"
      fill="#ffcc00"
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
    <path
      d="M2,3h12v2h-12z M2,7h12v2h-12z M2,11h12v2h-12z"
      fill="#212121"
    />
    <path
      d="M3,4h10v1h-10z M3,8h10v1h-10z M3,12h10v1h-10z"
      fill="#ffffff"
    />
  </svg>
);

const PixelCloseIcon: React.FC = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 16 16"
    style={{ imageRendering: 'pixelated' }}
  >
    <path
      d="M3,2h3v1h-3z M4,3h3v1h-3z M5,4h3v1h-3z M6,5h4v1h-4z M6,6h1v4h-1z M9,6h1v4h-1z M6,10h4v1h-4z M5,11h3v1h-3z M4,12h3v1h-3z M3,13h3v1h-3z
         M10,2h3v1h-3z M9,3h3v1h-3z M8,4h3v1h-3z M8,11h3v1h-3z M9,12h3v1h-3z M10,13h3v1h-3z"
      fill="#212121"
    />
    <path
      d="M4,2h1v1h-1z M5,3h1v1h-1z M6,4h1v1h-1z M7,5h2v1h-2z M7,6h2v4h-2z M7,10h2v1h-2z M6,11h1v1h-1z M5,12h1v1h-1z M4,13h1v1h-1z
         M11,2h1v1h-1z M10,3h1v1h-1z M9,4h1v1h-1z M9,11h1v1h-1z M10,12h1v1h-1z M11,13h1v1h-1z"
      fill="#ef4444"
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
          {toolbarExpanded ? <PixelCloseIcon /> : <PixelHamburgerIcon />}
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
