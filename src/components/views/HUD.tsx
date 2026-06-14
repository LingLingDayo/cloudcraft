import React, { useEffect, useState } from 'react';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '@i18n';
import { ItemRegistry } from '@game/item/ItemRegistry';
import { getBlockProperties } from '@game/world/BlockConfig';
import styles from './HUD.module.scss';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';
import { Inventory } from './Inventory';
import { Dialog } from '@components/common/Dialog';
import { useGame } from '@context/GameContext';
import { BlockIcon } from './ItemIcon';
import { MobileControls, PixelDotsIcon } from './MobileControls';
import { isMobileDevice } from '@utils/device';
import { Minimap } from './Minimap';

const PixelHeart: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 9 9"
    style={{ imageRendering: 'pixelated' }}
    className={styles.pixelHeart}
  >
    {/* Black Outline */}
    <path
      d="M2,0h1v1h-1z M6,0h1v1h-1z M1,1h1v1h-1z M3,1h1v1h-1z M5,1h1v1h-1z M7,1h1v1h-1z M0,2h1v1h-1z M4,2h1v1h-1z M8,2h1v1h-1z M0,3h1v1h-1z M8,3h1v1h-1z M1,4h1v1h-1z M7,4h1v1h-1z M2,5h1v1h-1z M6,5h1v1h-1z M3,6h1v1h-1z M5,6h1v1h-1z M4,7h1v1h-1z"
      fill="#000000"
    />
    {filled ? (
      <>
        {/* Heart Fill (Red) */}
        <path
          d="M6,1h1v1h-1z M2,2h2v1h-2z M5,2h3v1h-3z M1,3h7v1h-7z M2,4h5v1h-5z M3,5h3v1h-3z M4,6h1v1h-1z"
          fill="#ff2222"
        />
        {/* Highlight (White) */}
        <path
          d="M2,1h1v1h-1z M1,2h1v1h-1z"
          fill="#ffffff"
        />
      </>
    ) : (
      /* Empty Heart Fill (Grey) */
      <path
        d="M2,1h1v1h-1z M6,1h1v1h-1z M1,2h3v1h-3z M5,2h3v1h-3z M1,3h7v1h-7z M2,4h5v1h-5z M3,5h3v1h-3z M4,6h1v1h-1z"
        fill="#434343"
      />
    )}
  </svg>
);


// Hunger bar icon pixel layout mapping
// 0: transparent, 1: black outline, 2: bone, 3: light meat, 4: dark meat
const HUNGER_GRID = [
  [0, 0, 0, 0, 0, 1, 1, 1, 0], // y=0: top outline (5,6,7)
  [0, 0, 0, 0, 1, 3, 3, 4, 1], // y=1: outline (4,8), meat (5,6,7)
  [0, 0, 0, 1, 3, 3, 3, 4, 1], // y=2: outline (3,8), meat (4,5,6,7)
  [0, 0, 1, 3, 3, 3, 4, 4, 1], // y=3: outline (2,8), meat (3,4,5,6,7)
  [0, 0, 1, 3, 3, 4, 4, 1, 0], // y=4: outline (2,7), meat (3,4,5,6)
  [0, 0, 1, 2, 4, 4, 1, 0, 0], // y=5: outline (2,6), bone (3), meat (4,5)
  [1, 1, 2, 1, 1, 1, 0, 0, 0], // y=6: outline (0,1,3,4,5), bone (2)
  [2, 2, 1, 0, 0, 0, 0, 0, 0], // y=7: outline (2), bone (0,1)
  [1, 2, 1, 0, 0, 0, 0, 0, 0], // y=8: outline (0,2), bone (1)
];

const PixelHunger: React.FC<{ filled: number }> = ({ filled }) => {
  const getColor = (val: number) => {
    switch (val) {
      case 1:
        return '#000000';
      case 2:
        return filled > 0 ? '#e0e0e0' : '#434343';
      case 3:
        return filled === 2 ? '#ab6026' : '#434343';
      case 4:
        return filled >= 1 ? '#703811' : '#434343';
      default:
        return 'transparent';
    }
  };

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 9 9"
      style={{ imageRendering: 'pixelated' }}
      className={styles.pixelHunger}
    >
      {HUNGER_GRID.flatMap((row, y) =>
        row.map((val, x) => {
          if (val === 0) return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={getColor(val)}
            />
          );
        })
      )}
    </svg>
  );
};


const DebugPanel: React.FC = () => {
  const { t } = useTranslation();
  const debugMetrics = useGameStore((state) => state.debugMetrics);

  if (!debugMetrics) return null;

  return (
    <div className={`glass-panel ${styles.debugPanel}`}>
      <div className={`pixel-text-sm ${styles.debugTitle}`}>
        {t('hud.debugTitle')}
      </div>
      
      <div className={styles.debugSection}>
        <div className={styles.sectionHeader}>{t('hud.system')}</div>
        <div>
          {t('hud.fps')}: <span style={{ color: debugMetrics.fps >= 50 ? '#4ade80' : '#fb7185', fontWeight: 'bold' }}>{debugMetrics.fps}</span>
        </div>
        <div>
          {t('hud.chunksLoaded')}: <span className={styles.chunkCount}>{debugMetrics.chunksLoaded}</span>
        </div>
        <div>
          {t('hud.chunkLoadSpeed')}: <span className={styles.chunkCount}>{debugMetrics.chunkLoadSpeed.toFixed(1)}</span> {t('hud.chunksPerSecond')}
        </div>
        <div>
          {t('hud.flyMode')}:{' '}
          <span style={{ color: debugMetrics.isFlying ? '#38bdf8' : '#94a3b8', fontWeight: 'bold' }}>
            {debugMetrics.isFlying ? t('hud.flyModeOn') : t('hud.flyModeOff')}
          </span>
        </div>
      </div>

      <div className={styles.debugSection}>
        <div className={styles.sectionHeader}>{t('hud.player')}</div>
        <div>
          XYZ: <span className={styles.coordValue}>{debugMetrics.playerPosition.x.toFixed(3)} / {debugMetrics.playerPosition.y.toFixed(3)} / {debugMetrics.playerPosition.z.toFixed(3)}</span>
        </div>
        <div>
          {t('hud.chunk')}: <span className={styles.coordValue}>{debugMetrics.chunkCoords.cx} {debugMetrics.chunkCoords.cy} {debugMetrics.chunkCoords.cz}</span> {t('hud.local')}: <span className={styles.coordValue}>{debugMetrics.chunkCoords.lx} {debugMetrics.chunkCoords.ly} {debugMetrics.chunkCoords.lz}</span>
        </div>
        <div>
          {t('hud.facing')}: <span className={styles.directionValue}>{debugMetrics.playerDirection}</span>
        </div>
        <div>
          {t('hud.yawPitch')}: <span className={styles.rotationValue}>{debugMetrics.playerRotation.yaw.toFixed(1)}° / {debugMetrics.playerRotation.pitch.toFixed(1)}°</span>
        </div>
      </div>

      <div className={styles.debugSection}>
        <div className={styles.sectionHeader}>{t('hud.world')}</div>
        <div className={styles.debugRow}>
          <span>
            {t('hud.biome')}: <span className={styles.biomeName}>{debugMetrics.biome ? debugMetrics.biome.name : t('hud.none')}</span>
          </span>
          <span className={styles.rowDivider}>|</span>
          <span>
            {t('hud.landform')}: <span className={styles.biomeName}>{debugMetrics.landform ? debugMetrics.landform.name : t('hud.none')}</span>
          </span>
        </div>
        {debugMetrics.biome && (
          <div>
            {t('hud.tempMoist')}: <span className={styles.biomeDetail}>{debugMetrics.biome.temp.toFixed(2)} / {debugMetrics.biome.moisture.toFixed(2)}</span>
          </div>
        )}
        {debugMetrics.landform && (
          <div>
            {t('hud.contErosSlope')}: <span className={styles.biomeDetail}>{debugMetrics.landform.continentalness.toFixed(2)} / {debugMetrics.landform.erosion.toFixed(2)} / {debugMetrics.slope.toFixed(2)}</span>
          </div>
        )}
        <div>
          {t('hud.terrainHeight')}: <span className={styles.heightValue}>{debugMetrics.terrainHeight}</span>
        </div>
        <div>
          {t('hud.gameTime')}: <span className={styles.timeValue}>{debugMetrics.gameTime.formatted}</span>
        </div>
        <div>
          {t('hud.entities')}: <span className={styles.entityValue}>{t('hud.droppedItems')}: {debugMetrics.entities.droppedItems} / {t('hud.animals')}: {debugMetrics.entities.animals}</span>
        </div>
      </div>

      <div className={styles.debugSection}>
        <div className={styles.sectionHeader}>{t('hud.renderer')}</div>
        <div>
          {t('hud.drawCalls')}: <span className={styles.renderValue}>{debugMetrics.renderer.drawCalls}</span>
        </div>
        <div>
          {t('hud.triangles')}: <span className={styles.renderValue}>{debugMetrics.renderer.triangles.toLocaleString()}</span>
        </div>
        <div>
          {t('hud.geometriesTextures')}: <span className={styles.renderValue}>{debugMetrics.renderer.geometries} / {debugMetrics.renderer.textures}</span>
        </div>
        <div>
          GPU: <span className={styles.renderValue} style={{ fontSize: '10px', wordBreak: 'break-all' }}>{debugMetrics.renderer.gpu}</span>
        </div>
      </div>

      <div className={styles.targetBlockSection}>
        <span className={styles.label}>{t('hud.targetBlock')}:</span>
        {debugMetrics.targetBlock ? (
          <div className={styles.detail}>
            <div>{t('hud.targetBlockName')}: <span className={styles.blockName}>{t(`items.${getBlockProperties(debugMetrics.targetBlock.id).translationKey}`)}</span></div>
            <div>{t('hud.targetBlockCoords')}: <span className={styles.blockCoords}>({debugMetrics.targetBlock.x}, {debugMetrics.targetBlock.y}, {debugMetrics.targetBlock.z})</span></div>
          </div>
        ) : (
          <span className={styles.noBlock}>{t('hud.none')}</span>
        )}
      </div>
    </div>
  );
};



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
  const debugOverlay = useGameStore((state) => state.debugOverlay);
  const gameMode = useGameStore((state) => state.gameMode);
  const miningProgress = useGameStore((state) => state.miningProgress);

  const activeChest = useGameStore((state) => state.activeChest);
  const chestInventory = useGameStore((state) => state.chestInventory);
  const quickMoveItem = useGameStore((state) => state.quickMoveItem);
  const closeChest = useGameStore((state) => state.closeChest);
  const isInventoryOpen = useGameStore((state) => state.isInventoryOpen);





  const handleQuickMove = (from: 'hotbar' | 'chest', index: number) => {
    quickMoveItem(from, index);
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
        setActiveLabel(t(`items.${selectedItem}`));
      });

      const timeout = window.setTimeout(() => {
        setActiveLabel('');
      }, 2000);

      return () => {
        cancelAnimationFrame(frameId);
        window.clearTimeout(timeout);
      };
    } else {
      const frameId = requestAnimationFrame(() => {
        setActiveLabel('');
      });
      return () => {
        cancelAnimationFrame(frameId);
      };
    }
  }, [selectedItem, t]);

  // Release pointer lock when inventory opens or chest is active
  useEffect(() => {
    if (isInventoryOpen || activeChest) {
      document.exitPointerLock?.();
    }
  }, [isInventoryOpen, activeChest]);

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
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setActiveSlot(index);
                }}
                onClick={() => {
                  if (!isMobile) setActiveSlot(index);
                }}
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
              onTouchStart={(e) => {
                e.stopPropagation();
                const state = useGameStore.getState();
                if (state.activeChest) {
                  state.closeChest();
                } else {
                  state.toggleInventory();
                }
              }}
              onClick={() => {
                if (!isMobile) {
                  const state = useGameStore.getState();
                  if (state.activeChest) {
                    state.closeChest();
                  } else {
                    state.toggleInventory();
                  }
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
      {debugOverlay && <DebugPanel />}
      {activeChest && (
        <Dialog
          title={t('hud.chest')}
          onClose={() => {
            closeChest();
            gameInstance?.controls?.requestLock();
          }}
          width={400}
        >
          <div className={styles.chestContent}>
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
        </Dialog>
      )}
      <Minimap />
      <Inventory />
      <MobileControls />

    </div>
  );
};

