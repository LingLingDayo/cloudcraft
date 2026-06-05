import React, { useEffect, useState } from 'react';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '../../i18n';
import { ItemRegistry } from '@game/item/ItemRegistry';
import styles from './HUD.module.scss';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';
import { Inventory } from './Inventory';
import { useGame } from '../../context/GameContext';
import { BlockIcon } from './BlockIcon';
import { MobileControls, PixelDotsIcon } from './MobileControls';
import { formatCoordinate } from '../../utils/helpers';
import { isMobileDevice } from '../../utils/device';
import { Minimap } from './Minimap';

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


const PixelHunger: React.FC<{ filled: number }> = ({ filled }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 9 9"
    style={{ imageRendering: 'pixelated' }}
    className={styles.pixelHunger}
  >
    {/* Black Outline */}
    <path
      d="M4,0h3v1h-3z M3,1h1v1h-1z M7,1h1v1h-1z M2,2h1v1h-1z M8,2h1v1h-1z M2,3h1v1h-1z M8,3h1v1h-1z M3,4h1v1h-1z M7,4h1v1h-1z M4,5h1v1h-1z M6,5h1v1h-1z M3,6h1v1h-1z M5,6h1v1h-1z M1,7h2v1h-2z M4,7h1v1h-1z M0,8h2v1h-2z M3,8h1v1h-1z"
      fill="#000000"
    />
    {filled === 2 ? (
      <>
        {/* Bone (White) */}
        <path
          d="M5,5h1v1h-1z M4,6h1v1h-1z M2,7h2v1h-2z M1,8h2v1h-2z"
          fill="#e0e0e0"
        />
        {/* Meat Shadow (Dark Brown) */}
        <path
          d="M3,2h2v1h-2z M3,3h2v1h-2z M4,4h2v1h-2z"
          fill="#703811"
        />
        {/* Meat Main (Brown) */}
        <path
          d="M4,1h3v1h-3z M5,2h3v1h-3z M5,3h3v1h-3z M6,4h1v1h-1z"
          fill="#ab6026"
        />
      </>
    ) : filled === 1 ? (
      <>
        {/* Empty part (Grey) */}
        <path
          d="M4,1h1v1h-1z M3,2h3v1h-3z M3,3h3v1h-3z M4,4h2v1h-2z M5,5h1v1h-1z M4,6h1v1h-1z M2,7h2v1h-2z M1,8h2v1h-2z"
          fill="#434343"
        />
        {/* Half Meat (Brown) */}
        <path
          d="M5,1h2v1h-2z M6,2h2v1h-2z M6,3h2v1h-2z M6,4h1v1h-1z"
          fill="#ab6026"
        />
      </>
    ) : (
      /* Entirely Empty (Grey) */
      <path
        d="M4,1h3v1h-3z M3,2h5v1h-5z M3,3h5v1h-5z M4,4h3v1h-3z M5,5h1v1h-1z M4,6h1v1h-1z M2,7h2v1h-2z M1,8h2v1h-2z"
        fill="#434343"
      />
    )}
  </svg>
);



export const HUD: React.FC = () => {
  const { t } = useTranslation();
  const [activeLabel, setActiveLabel] = useState<string>('');
  const [isMobile] = useState(() => isMobileDevice());
  const gameInstance = useGame();

  const selectedItem = useGameStore((state) => state.selectedItem);
  const hotbar = useGameStore((state) => state.hotbar);
  const activeSlot = useGameStore((state) => state.activeSlot);
  const setActiveSlot = useGameStore((state) => state.setActiveSlot);
  const life = useGameStore((state) => state.life);
  const hunger = useGameStore((state) => state.hunger);
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





  const handleQuickMove = (from: 'hotbar' | 'chest', index: number) => {
    quickMoveItem(from, index);
    const nextChest = useGameStore.getState().chestInventory;
    if (activeChest && gameInstance) {
      const entity = gameInstance.world.blockEntities.getEntity(activeChest.x, activeChest.y, activeChest.z);
      if (entity && 'inventory' in entity) {
        (entity as { inventory: typeof nextChest }).inventory = [...nextChest];
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
          gameInstance?.controls?.requestLock();
        } else {
          state.toggleInventory();
        }
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [setActiveSlot, gameInstance]);

  // Show item label briefly when selected item changes
  useEffect(() => {
    const state = useGameStore.getState();
    const activeItem = state.hotbar[state.activeSlot];
    if (activeItem && selectedItem) {
      const frameId = requestAnimationFrame(() => {
        setActiveLabel(t(`blocks.${selectedItem}`));
      });

      const timeout = window.setTimeout(() => {
        setActiveLabel('');
      }, 2000);

      return () => {
        cancelAnimationFrame(frameId);
        window.clearTimeout(timeout);
      };
    }
  }, [selectedItem, t]);

  // Release pointer lock when inventory opens or chest is active
  useEffect(() => {
    if (isInventoryOpen || activeChest) {
      document.exitPointerLock?.();
    }
  }, [isInventoryOpen, activeChest]);

  // Format coordinates to 1 decimal place using helper function
  const fx = formatCoordinate(position.x);
  const fy = formatCoordinate(position.y);
  const fz = formatCoordinate(position.z);

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



      {/* Hotbar & Status Bar Wrapper */}
      <div className={`hotbar-wrapper ${isMobile ? 'is-mobile' : ''}`}>
        {/* Selected Block Label */}
        {activeLabel && <div className="hotbar-label pixel-text-sm">{activeLabel}</div>}

        {/* Hotbar Stats (Hearts & Hunger) */}
        {gameMode !== 'creative' && (
          <div className="hud-hotbar-stats">
            <div className="hud-hearts">
              {Array.from({ length: 10 }).map((_, i) => (
                <PixelHeart key={i} filled={i < life} />
              ))}
            </div>
            <div className="hud-hunger">
              {Array.from({ length: 10 }).map((_, i) => {
                let filled = 0;
                if (hunger >= i * 2 + 2) {
                  filled = 2;
                } else if (hunger >= i * 2 + 1) {
                  filled = 1;
                }
                return <PixelHunger key={i} filled={filled} />;
              })}
            </div>
          </div>
        )}


        {/* Hotbar slots */}
        <div className="hotbar-container">
          {Array.from({ length: 9 }).map((_, index) => {
            const isActive = index === activeSlot;
            const item = hotbar[index];
            
            // Helper to get display info for an item type
            const props = item ? ItemRegistry.get(item.type) : null;
            
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
          {isMobile && (
            <div
              className="hotbar-slot mobile-inventory-btn"
              onClick={() => {
                const state = useGameStore.getState();
                if (state.activeChest) {
                  state.closeChest();
                } else {
                  state.toggleInventory();
                }
              }}
              title={t('controls.openInventory')}
            >
              <PixelDotsIcon />
            </div>
          )}
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
      <Minimap />
      <Inventory />
      <MobileControls />

    </div>
  );
};

