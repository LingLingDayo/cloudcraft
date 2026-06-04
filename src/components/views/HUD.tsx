/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { BLOCK_TYPES, getBlockProperties } from '@game/world/World';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '../../i18n';
import styles from './HUD.module.scss';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';
import { Inventory } from './Inventory';
import { useGame } from '../../context/GameContext';
import { BlockIcon } from './BlockIcon';

const PixelHeart: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 9 9"
    style={{ imageRendering: 'pixelated' }}
    className={styles.pixelHeart}
  >
    <path
      d="M1,0h2v1h-2z M6,0h2v1h-2z M0,1h1v1h-1z M3,1h1v1h-1z M5,1h1v1h-1z M8,1h1v1h-1z M0,2h1v1h-1z M8,2h1v1h-1z M0,3h1v1h-1z M8,3h1v1h-1z M1,4h1v1h-1z M7,4h1v1h-1z M2,5h1v1h-1z M6,5h1v1h-1z M3,6h1v1h-1z M5,6h1v1h-1z M4,7h1v1h-1z"
      fill="#000000"
    />
    {filled ? (
      <>
        <path
          d="M2,1h1v1h-1z M6,1h2v1h-2z M1,2h7v1h-7z M1,3h7v1h-7z M2,4h5v1h-5z M3,5h3v1h-3z M4,6h1v1h-1z"
          fill="#ff2222"
        />
        <path d="M1,1h1v1h-1z" fill="#ffffff" />
      </>
    ) : (
      <path
        d="M1,1h2v1h-2z M6,1h2v1h-2z M1,2h7v1h-7z M1,3h7v1h-7z M2,4h5v1h-5z M3,5h3v1h-3z M4,6h1v1h-1z"
        fill="#434343"
      />
    )}
  </svg>
);

import { SaveManager } from '@game/systems/SaveManager';
import { GameState } from '@type';
import { SettingsDialog } from './SettingsDialog';

export const HUD: React.FC = () => {
  const { t } = useTranslation();
  const [activeLabel, setActiveLabel] = useState<string>('');
  const gameInstance = useGame();

  const selectedBlock = useGameStore((state) => state.selectedBlock);
  const hotbar = useGameStore((state) => state.hotbar);
  const activeSlot = useGameStore((state) => state.activeSlot);
  const setActiveSlot = useGameStore((state) => state.setActiveSlot);
  const life = useGameStore((state) => state.life);
  const position = useGameStore((state) => state.position);
  const onGround = useGameStore((state) => state.onGround);
  const inWater = useGameStore((state) => state.inWater);
  const debugOverlay = useGameStore((state) => state.debugOverlay);
  const debugMetrics = useGameStore((state) => state.debugMetrics);
  const gameMode = useGameStore((state) => state.gameMode);
  const miningProgress = useGameStore((state) => state.miningProgress);

  const activeChest = useGameStore((state) => state.activeChest);
  const chestInventory = useGameStore((state) => state.chestInventory);
  const quickMoveItem = useGameStore((state) => state.quickMoveItem);
  const closeChest = useGameStore((state) => state.closeChest);
  const isInventoryOpen = useGameStore((state) => state.isInventoryOpen);

  const setGameState = useGameStore((state) => state.setGameState);

  // Mobile support states
  const [isMobile, setIsMobile] = useState(false);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeDirections, setActiveDirections] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
    center: false,
  });

  const dpadRef = React.useRef<HTMLDivElement>(null);

  // Detect mobile environment
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     ('ontouchstart' in window) || 
                     (navigator.maxTouchPoints > 0);
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save game handler
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

  const handleQuit = async () => {
    await handleSave();
    setGameState(GameState.MENU);
  };

  // D-pad Touches
  const handleDpadTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.cancelable) {
      e.preventDefault();
    }

    if (!dpadRef.current) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = dpadRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const tx = touch.clientX;
    const ty = touch.clientY;

    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(-dy, dx); // Cartesion angle (up is positive, right is positive)

    const maxRadius = rect.width / 2;
    const centerRadius = rect.width * 0.22; // Center jump area

    let up = false;
    let down = false;
    let left = false;
    let right = false;
    let center = false;

    if (dist < centerRadius) {
      center = true;
    } else if (dist <= maxRadius * 1.5) {
      // UP: angle is between [22.5, 157.5]
      if (angle >= Math.PI / 8 && angle <= (7 * Math.PI) / 8) {
        up = true;
      }
      // DOWN: angle is between [-157.5, -22.5]
      if (angle >= (-7 * Math.PI) / 8 && angle <= -Math.PI / 8) {
        down = true;
      }
      // RIGHT: angle is between [-67.5, 67.5]
      if (angle >= -3 * Math.PI / 8 && angle <= 3 * Math.PI / 8) {
        right = true;
      }
      // LEFT: angle is between [112.5, 180] or [-180, -112.5]
      if (angle >= (5 * Math.PI) / 8 || angle <= (-5 * Math.PI) / 8) {
        left = true;
      }
    }

    setActiveDirections({ up, down, left, right, center });

    // Sync state to HotkeyManager
    hotkeyManager.setActionPressed(GameAction.MOVE_FORWARD, up);
    hotkeyManager.setActionPressed(GameAction.MOVE_BACKWARD, down);
    hotkeyManager.setActionPressed(GameAction.MOVE_LEFT, left);
    hotkeyManager.setActionPressed(GameAction.MOVE_RIGHT, right);
    hotkeyManager.setActionPressed(GameAction.JUMP, center);
  };

  const handleDpadTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();

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
  };

  const handleQuickMove = (from: 'hotbar' | 'chest', index: number) => {
    quickMoveItem(from, index);
    const nextChest = useGameStore.getState().chestInventory;
    if (activeChest && gameInstance) {
      const entity = gameInstance.world.blockEntities.getEntity(activeChest.x, activeChest.y, activeChest.z);
      if (entity && 'inventory' in entity) {
        (entity as any).inventory = [...nextChest];
      }
    }
  };


  // Keyboard 1-9 number row selection and inventory toggle using HotkeyManager
  useEffect(() => {
    const unsubscribers = Array.from({ length: 9 }).map((_, index) => {
      const slotNum = index + 1;
      const action = `HOTBAR_${slotNum}` as GameAction;
      return hotkeyManager.onActionDown(action, () => {
        const state = useGameStore.getState();
        if (!state.isInventoryOpen && !state.activeChest) {
          setActiveSlot(index);
        }
      });
    });

    // Toggle inventory or close chest
    unsubscribers.push(
      hotkeyManager.onActionDown(GameAction.OPEN_INVENTORY, () => {
        const state = useGameStore.getState();
        if (state.activeChest) {
          state.closeChest();
          gameInstance?.controls?.domElement?.requestPointerLock();
        } else {
          state.toggleInventory();
        }
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [setActiveSlot, gameInstance]);

  // Show item label briefly when selected block changes
  useEffect(() => {
    const props = getBlockProperties(selectedBlock);
    if (props && selectedBlock !== BLOCK_TYPES.AIR) {
      const frameId = requestAnimationFrame(() => {
        setActiveLabel(t(`blocks.${selectedBlock}`));
      });

      const timeout = window.setTimeout(() => {
        setActiveLabel('');
      }, 2000);

      return () => {
        cancelAnimationFrame(frameId);
        window.clearTimeout(timeout);
      };
    }
  }, [selectedBlock, t]);

  // Release pointer lock when inventory opens or chest is active
  useEffect(() => {
    if (isInventoryOpen || activeChest) {
      document.exitPointerLock?.();
    }
  }, [isInventoryOpen, activeChest]);

  // Format coordinates to 1 decimal place
  const fx = position.x.toFixed(1);
  const fy = position.y.toFixed(1);
  const fz = position.z.toFixed(1);

  return (
    <div className="hud-overlay">
      {/* Target Crosshair */}
      <div className="crosshair">
        {miningProgress !== null && (
          <svg className="mining-progress-svg" viewBox="0 0 36 36" style={{ display: 'block' }}>
            <circle
              className="mining-progress-circle"
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="#818cf8"
              strokeWidth="3.5"
              strokeDasharray="100"
              strokeDashoffset={100 - (miningProgress * 100)}
            />
          </svg>
        )}
      </div>

      {/* Top Left Status Info */}
      {import.meta.env.DEV && (
        <div className={`hud-stats glass-panel ${styles.devStats}`}>
          <div className={`pixel-text-sm ${styles.devTitle}`}>
            MINICRAFT (DEV)
          </div>
          <div>
            XYZ: {fx} / {fy} / {fz}
          </div>
          <div className={styles.devDetails}>
            Ground: {onGround ? 'YES' : 'NO'} | Water: {inWater ? 'YES' : 'NO'}
          </div>
        </div>
      )}

      {/* Collapsible Toolbar for Mobile (Top Right) */}
      {isMobile && (
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
                setShowSettings(true);
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
      )}

      {/* Mobile D-pad Control (Bottom Left) */}
      {isMobile && (
        <div 
          className={styles.dpadContainer}
          onTouchStart={handleDpadTouch}
          onTouchMove={handleDpadTouch}
          onTouchEnd={handleDpadTouchEnd}
          onTouchCancel={handleDpadTouchEnd}
        >
          <div className={styles.dpad} ref={dpadRef}>
            <div className={`${styles.dpadSector} ${styles.up} ${activeDirections.up ? styles.active : ''}`}>
              <span className={styles.arrowIcon}>▲</span>
            </div>
            <div className={`${styles.dpadSector} ${styles.down} ${activeDirections.down ? styles.active : ''}`}>
              <span className={styles.arrowIcon}>▼</span>
            </div>
            <div className={`${styles.dpadSector} ${styles.left} ${activeDirections.left ? styles.active : ''}`}>
              <span className={styles.arrowIcon}>◀</span>
            </div>
            <div className={`${styles.dpadSector} ${styles.right} ${activeDirections.right ? styles.active : ''}`}>
              <span className={styles.arrowIcon}>▶</span>
            </div>
            <div className={`${styles.dpadCenter} ${activeDirections.center ? styles.active : ''}`}>
              <span className={styles.jumpIcon}>⏏</span>
            </div>
          </div>
        </div>
      )}

      {/* Hotbar & Status Bar Wrapper */}
      <div className="hotbar-wrapper">
        {/* Selected Block Label */}
        {activeLabel && <div className="hotbar-label pixel-text-sm">{activeLabel}</div>}

        {/* Hotbar Stats (Hearts) */}
        {gameMode !== 'creative' && (
          <div className="hud-hotbar-stats">
            <div className="hud-hearts">
              {Array.from({ length: 10 }).map((_, i) => (
                <PixelHeart key={i} filled={i < life} />
              ))}
            </div>
          </div>
        )}


        {/* Hotbar slots */}
        <div className="hotbar-container">
          {Array.from({ length: 9 }).map((_, index) => {
            const isActive = index === activeSlot;
            const item = hotbar[index];
            
            // Helper to get display info for a block type
            const props = item ? getBlockProperties(item.type) : null;
            
            return (
              <div
                key={index}
                className={`hotbar-slot ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSlot(index)}
              >
                <span className="hotbar-slot-key">{index + 1}</span>
                {item && props ? (
                  <>
                    <BlockIcon blockId={item.type} size={24} className="block-preview" />
                    {item.count > 0 && gameMode !== 'creative' && (
                      <span className="hotbar-slot-count">{item.count}</span>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {/* Top Right Debug Dashboard (F3) */}
      {debugOverlay && debugMetrics && (
        <div className={`glass-panel ${styles.debugPanel}`}>
          <div className={`pixel-text-sm ${styles.debugTitle}`}>
            {t('hud.debugTitle')}
          </div>
          <div>
            {t('hud.fps')}: <span style={{ color: debugMetrics.fps >= 50 ? '#4ade80' : '#fb7185', fontWeight: 'bold' }}>{debugMetrics.fps}</span>
          </div>
          <div>
            {t('hud.chunksLoaded')}: <span className={styles.chunkCount}>{debugMetrics.chunksLoaded}</span>
          </div>
          <div>
            {t('hud.flyMode')}:{' '}
            <span style={{ color: debugMetrics.isFlying ? '#38bdf8' : '#94a3b8', fontWeight: 'bold' }}>
              {debugMetrics.isFlying ? t('hud.flyModeOn') : t('hud.flyModeOff')}
            </span>
          </div>
          <div className={styles.targetBlockSection}>
            <span className={styles.label}>{t('hud.targetBlock')}:</span>
            {debugMetrics.targetBlock ? (
              <div className={styles.detail}>
                <div>{t('hud.targetBlockName')}: <span className={styles.blockName}>{t(`blocks.${debugMetrics.targetBlock.id}`)}</span></div>
                <div>{t('hud.targetBlockCoords')}: <span className={styles.blockCoords}>({debugMetrics.targetBlock.x}, {debugMetrics.targetBlock.y}, {debugMetrics.targetBlock.z})</span></div>
              </div>
            ) : (
              <span className={styles.noBlock}>{t('hud.none')}</span>
            )}
          </div>
        </div>
      )}
      {activeChest && (
        <div className={styles.chestOverlay}>
          <div className={`${styles.chestWindow} glass-panel`}>
            <div className={styles.chestHeader}>
              <span className="pixel-text-sm">{t('hud.chest')}</span>
              <button className={styles.closeBtn} onClick={() => {
                closeChest();
                gameInstance?.controls?.requestLock();
              }}>✕</button>
            </div>
            <div className={styles.sectionTitle}>{t('hud.chestItems')}</div>
            <div className={styles.chestGrid}>
              {chestInventory.map((item, idx) => (
                <div key={`c-${idx}`} className={styles.chestSlot} onClick={() => handleQuickMove('chest', idx)}>
                  {item ? (
                    <>
                      <BlockIcon blockId={item.type} size={16} className={styles.itemPreview} />
                      <span className={styles.itemCount}>{item.count}</span>
                    </>
                  ) : <div className={styles.itemEmpty} />}
                </div>
              ))}
            </div>
            <div className={styles.divider} />
            <div className={styles.sectionTitle}>{t('hud.hotbar')}</div>
            <div className={styles.hotbarGrid}>
              {hotbar.map((item, idx) => (
                <div key={`h-${idx}`} className={styles.hotbarSlot} onClick={() => handleQuickMove('hotbar', idx)}>
                  {item ? (
                    <>
                      <BlockIcon blockId={item.type} size={16} className={styles.itemPreview} />
                      <span className={styles.itemCount}>{item.count}</span>
                    </>
                  ) : <div className={styles.itemEmpty} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <Inventory />

      {/* Settings Dialog directly mapped for Mobile */}
      {showSettings && (
        <SettingsDialog 
          onClose={() => {
            setShowSettings(false);
            setGameState(GameState.PLAYING);
          }} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
};

