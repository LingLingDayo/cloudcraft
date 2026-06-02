import React, { useEffect, useState } from 'react';
import { BLOCK_TYPES } from '../game/World';

interface HUDProps {
  selectedBlock: number;
  onSelectBlock: (blockType: number) => void;
  life: number;
  position: { x: number; y: number; z: number };
  onGround: boolean;
  inWater: boolean;
}

export const HOTBAR_ITEMS = [
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

export const HUD: React.FC<HUDProps> = ({
  selectedBlock,
  onSelectBlock,
  life,
  position,
  onGround,
  inWater,
}) => {
  const [activeLabel, setActiveLabel] = useState<string>('');
  const [labelTimeout, setLabelTimeout] = useState<number | null>(null);

  // Keyboard 1-9 number row selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // e.code ranges from Digit1 to Digit9
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          const item = HOTBAR_ITEMS[num - 1];
          if (item) {
            onSelectBlock(item.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSelectBlock]);

  // Show item label briefly when selected block changes
  useEffect(() => {
    const activeItem = HOTBAR_ITEMS.find((item) => item.id === selectedBlock);
    if (activeItem) {
      setActiveLabel(activeItem.name);

      if (labelTimeout) {
        window.clearTimeout(labelTimeout);
      }

      const timeout = window.setTimeout(() => {
        setActiveLabel('');
      }, 2000);

      setLabelTimeout(timeout);
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
      <div className="hud-stats glass-panel">
        <div style={{ fontWeight: 'bold', color: '#f8fafc', marginBottom: '6px' }} className="pixel-text-sm">
          MINICRAFT
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          XYZ: {fx} / {fy} / {fz}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
          Ground: {onGround ? 'YES' : 'NO'} | Water: {inWater ? 'YES' : 'NO'}
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
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

      {/* Selected Block Label */}
      {activeLabel && <div className="hotbar-label pixel-text-sm">{activeLabel}</div>}

      {/* Hotbar slots */}
      <div className="hotbar-container">
        {HOTBAR_ITEMS.map((item, index) => {
          const isActive = item.id === selectedBlock;
          return (
            <div
              key={item.id}
              className={`hotbar-slot ${isActive ? 'active' : ''}`}
              onClick={() => onSelectBlock(item.id)}
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
  );
};
