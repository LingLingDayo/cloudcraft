/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { BLOCK_TYPES } from '@game/world/World';
import { useGameStore } from '@store/useGameStore';
import styles from './HUD.module.scss';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';
import { Inventory } from './Inventory';

const HOTBAR_ITEMS = [
  { id: BLOCK_TYPES.GRASS, name: '草方块', color: '#56a032', border: 'none' },
  { id: BLOCK_TYPES.DIRT, name: '泥土', color: '#825a3c', border: 'none' },
  { id: BLOCK_TYPES.STONE, name: '石头', color: '#787878', border: 'none' },
  { id: BLOCK_TYPES.WOOD, name: '原木', color: '#78552d', border: 'none' },
  { id: BLOCK_TYPES.LEAF, name: '树叶', color: '#2d7823', border: 'none' },
  { id: BLOCK_TYPES.GLASS, name: '玻璃', color: 'rgba(150, 230, 255, 0.35)', border: '1.5px solid #96e6ff' },
  { id: BLOCK_TYPES.WATER, name: '水', color: 'rgba(40, 110, 220, 0.75)', border: 'none' },
  { id: BLOCK_TYPES.SAND, name: '沙子', color: '#dccd8c', border: 'none' },
  { id: BLOCK_TYPES.DIAMOND, name: '钻石矿', color: '#5cdcfa', border: '1.5px solid #2db4d2' },
];

const getBlockColor = (type: number): string => {
  const found = HOTBAR_ITEMS.find(item => item.id === type);
  if (found) return found.color;
  if (type === 13) return '#78552d'; // 木箱色
  if (type === 14) return '#787878'; // 拉杆灰
  return '#a1a1aa';
};

const getBlockBorder = (type: number): string => {
  const found = HOTBAR_ITEMS.find(item => item.id === type);
  return found ? found.border : 'none';
};

const PixelHeart: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 9 9"
    style={{ imageRendering: 'pixelated' }}
    className={styles.pixelHeart}
  >
    <path
      d="M1,0h2v1h-2z M6,0h2v1h-2z M0,1h1v1h-1z M3,1h1v1h-1z M5,1h1v1h-1z M8,1h1v1h-1z M0,2h1v1h-1z M4,2h1v1h-1z M8,2h1v1h-1z M0,3h1v1h-1z M8,3h1v1h-1z M1,4h1v1h-1z M7,4h1v1h-1z M2,5h1v1h-1z M6,5h1v1h-1z M3,6h1v1h-1z M5,6h1v1h-1z M4,7h1v1h-1z"
      fill="#000000"
    />
    {filled ? (
      <>
        <path
          d="M2,1h1v1h-1z M6,1h2v1h-2z M1,2h3v1h-3z M5,2h3v1h-3z M1,3h7v1h-7z M2,4h5v1h-5z M3,5h3v1h-3z M4,6h1v1h-1z"
          fill="#ff2222"
        />
        <path d="M1,1h1v1h-1z" fill="#ffffff" />
      </>
    ) : (
      <path
        d="M1,1h2v1h-2z M6,1h2v1h-2z M1,2h3v1h-3z M5,2h3v1h-3z M1,3h7v1h-7z M2,4h5v1h-5z M3,5h3v1h-3z M4,6h1v1h-1z"
        fill="#434343"
      />
    )}
  </svg>
);

export const HUD: React.FC = () => {
  const [activeLabel, setActiveLabel] = useState<string>('');

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

  const activeChest = useGameStore((state) => state.activeChest);
  const chestInventory = useGameStore((state) => state.chestInventory);
  const quickMoveItem = useGameStore((state) => state.quickMoveItem);
  const closeChest = useGameStore((state) => state.closeChest);

  const handleQuickMove = (from: 'hotbar' | 'chest', index: number) => {
    quickMoveItem(from, index, (nextChest) => {
      const gameInstance = (window as any).gameInstance;
      if (activeChest && gameInstance) {
        const entity = gameInstance.world.blockEntities.getEntity(activeChest.x, activeChest.y, activeChest.z);
        if (entity && 'inventory' in entity) {
          (entity as any).inventory = [...nextChest];
        }
      }
    });
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
          (window as any).gameInstance?.controls?.domElement?.requestPointerLock();
        } else {
          state.toggleInventory();
        }
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [setActiveSlot]);

  // Show item label briefly when selected block changes
  useEffect(() => {
    const activeItem = HOTBAR_ITEMS.find((item) => item.id === selectedBlock);
    if (activeItem) {
      const frameId = requestAnimationFrame(() => {
        setActiveLabel(activeItem.name);
      });

      const timeout = window.setTimeout(() => {
        setActiveLabel('');
      }, 2000);

      return () => {
        cancelAnimationFrame(frameId);
        window.clearTimeout(timeout);
      };
    }
  }, [selectedBlock]);

  // Format coordinates to 1 decimal place
  const fx = position.x.toFixed(1);
  const fy = position.y.toFixed(1);
  const fz = position.z.toFixed(1);

  return (
    <div className="hud-overlay">
      {/* Target Crosshair */}
      <div className="crosshair">
        <svg className="mining-progress-svg" viewBox="0 0 36 36">
          <circle
            id="mining-progress-circle"
            className="mining-progress-circle"
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="#818cf8"
            strokeWidth="3.5"
            strokeDasharray="100"
            strokeDashoffset="100"
          />
        </svg>
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
            const displayInfo = item ? HOTBAR_ITEMS.find((h) => h.id === item.type) : null;
            
            return (
              <div
                key={index}
                className={`hotbar-slot ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSlot(index)}
              >
                <span className="hotbar-slot-key">{index + 1}</span>
                {item && displayInfo ? (
                  <>
                    <div
                      className="block-preview"
                      style={{
                        backgroundColor: displayInfo.color,
                        border: displayInfo.border,
                      }}
                    ></div>
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
            调试控制台 (F3)
          </div>
          <div>
            FPS: <span style={{ color: debugMetrics.fps >= 50 ? '#4ade80' : '#fb7185', fontWeight: 'bold' }}>{debugMetrics.fps}</span>
          </div>
          <div>
            已载入区块: <span className={styles.chunkCount}>{debugMetrics.chunksLoaded}</span>
          </div>
          <div>
            创造飞行模式 (F4):{' '}
            <span style={{ color: debugMetrics.isFlying ? '#38bdf8' : '#94a3b8', fontWeight: 'bold' }}>
              {debugMetrics.isFlying ? '开启 (飞行中)' : '关闭'}
            </span>
          </div>
          <div className={styles.targetBlockSection}>
            <span className={styles.label}>指向方块:</span>
            {debugMetrics.targetBlock ? (
              <div className={styles.detail}>
                <div>名称: <span className={styles.blockName}>{debugMetrics.targetBlock.type}</span></div>
                <div>坐标: <span className={styles.blockCoords}>({debugMetrics.targetBlock.x}, {debugMetrics.targetBlock.y}, {debugMetrics.targetBlock.z})</span></div>
              </div>
            ) : (
              <span className={styles.noBlock}>无</span>
            )}
          </div>
        </div>
      )}
      {activeChest && (
        <div className={styles.chestOverlay}>
          <div className={`${styles.chestWindow} glass-panel`}>
            <div className={styles.chestHeader}>
              <span className="pixel-text-sm">储物箱 (Chest)</span>
              <button className={styles.closeBtn} onClick={() => {
                closeChest();
                (window as any).gameInstance?.controls?.lock();
              }}>✕</button>
            </div>
            <div className={styles.sectionTitle}>箱子物品</div>
            <div className={styles.chestGrid}>
              {chestInventory.map((item, idx) => (
                <div key={`c-${idx}`} className={styles.chestSlot} onClick={() => handleQuickMove('chest', idx)}>
                  {item ? (
                    <>
                      <div className={styles.itemPreview} style={{ backgroundColor: getBlockColor(item.type), border: getBlockBorder(item.type) }} />
                      <span className={styles.itemCount}>{item.count}</span>
                    </>
                  ) : <div className={styles.itemEmpty} />}
                </div>
              ))}
            </div>
            <div className={styles.divider} />
            <div className={styles.sectionTitle}>快捷栏</div>
            <div className={styles.hotbarGrid}>
              {hotbar.map((item, idx) => (
                <div key={`h-${idx}`} className={styles.hotbarSlot} onClick={() => handleQuickMove('hotbar', idx)}>
                  {item ? (
                    <>
                      <div className={styles.itemPreview} style={{ backgroundColor: getBlockColor(item.type), border: getBlockBorder(item.type) }} />
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
    </div>
  );
};

