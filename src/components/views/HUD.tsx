import React, { useEffect, useState } from 'react';
import { BLOCK_TYPES } from '@game/world/World';
import { useGameStore } from '@store/useGameStore';
import styles from './HUD.module.scss';
import { hotkeyManager, GameAction } from '@game/systems/HotkeyManager';

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

export const HUD: React.FC = () => {
  const [activeLabel, setActiveLabel] = useState<string>('');

  const selectedBlock = useGameStore((state) => state.selectedBlock);
  const setSelectedBlock = useGameStore((state) => state.setSelectedBlock);
  const life = useGameStore((state) => state.life);
  const position = useGameStore((state) => state.position);
  const onGround = useGameStore((state) => state.onGround);
  const inWater = useGameStore((state) => state.inWater);
  const debugOverlay = useGameStore((state) => state.debugOverlay);
  const debugMetrics = useGameStore((state) => state.debugMetrics);
  const gameMode = useGameStore((state) => state.gameMode);

  // Keyboard 1-9 number row selection using HotkeyManager
  useEffect(() => {
    const unsubscribers = Array.from({ length: 9 }).map((_, index) => {
      const slotNum = index + 1;
      const action = `HOTBAR_${slotNum}` as GameAction;
      return hotkeyManager.onActionDown(action, () => {
        const item = HOTBAR_ITEMS[index];
        if (item) {
          setSelectedBlock(item.id);
        }
      });
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [setSelectedBlock]);

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
      <div className="crosshair"></div>

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
                <span
                  key={i}
                  className="heart"
                  style={{
                    color: i < life ? '#ef4444' : '#475569',
                    opacity: i < life ? 1 : 0.4,
                  }}
                >
                  ❤
                </span>
              ))}
            </div>
          </div>
        )}


        {/* Hotbar slots */}
        <div className="hotbar-container">
          {HOTBAR_ITEMS.map((item, index) => {
            const isActive = item.id === selectedBlock;
            return (
              <div
                key={item.id}
                className={`hotbar-slot ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedBlock(item.id)}
              >
                <span className="hotbar-slot-key">{index + 1}</span>
                <div
                  className="block-preview"
                  style={{
                    backgroundColor: item.color,
                    border: item.border,
                  }}
                ></div>
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
    </div>
  );
};

