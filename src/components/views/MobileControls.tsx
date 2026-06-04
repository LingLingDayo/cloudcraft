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
          {toolbarExpanded ? '✕' : '☰'}
        </button>
        
        <div className={styles.toolbarMenu}>
          <button 
            className={`${styles.toolbarBtn} glass-panel`} 
            onClick={() => {
              setIsSettingsOpen(true, 'hud');
              setGameState(GameState.PAUSED);
              setToolbarExpanded(false);
            }}
          >
            ⚙️
          </button>
          <button 
            className={`${styles.toolbarBtn} glass-panel`} 
            onClick={() => {
              useGameStore.getState().toggleInventory();
              setToolbarExpanded(false);
            }}
          >
            🎒
          </button>
          <button 
            className={`${styles.toolbarBtn} glass-panel`} 
            onClick={() => {
              handleSave();
              setToolbarExpanded(false);
            }}
          >
            💾
          </button>
          <button 
            className={`${styles.toolbarBtn} ${styles.danger} glass-panel`} 
            onClick={handleQuit}
          >
            🚪
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
