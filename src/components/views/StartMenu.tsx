import React, { useState } from 'react';
import type { StartMenuProps } from '../../types';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { useGameStore } from '../../store/useGameStore';

export const StartMenu: React.FC<StartMenuProps> = ({ onStartGame }) => {
  const [seed, setSeed] = useState<string>(() => Math.floor(Math.random() * 999999).toString());
  const [renderDistance, setRenderDistance] = useState<number>(() => useGameStore.getState().renderDistance);
  const [fov, setFov] = useState<number>(() => useGameStore.getState().fov);
  const [hasSave] = useState<boolean>(() => !!localStorage.getItem('minicraft_save'));

  const handleStart = (loadSave: boolean) => {
    onStartGame(seed, renderDistance, fov, loadSave);
  };

  return (
    <div className="menu-bg">
      <div
        className="glass-panel"
        style={{
          width: '460px',
          padding: '40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div>
          {/* Pulsing Pixel Title */}
          <h1
            className="pixel-text"
            style={{
              fontSize: '36px',
              color: '#818cf8',
              margin: '0 0 10px 0',
              letterSpacing: '2px',
              animation: 'pulse 2s infinite alternate',
            }}
          >
            MINICRAFT
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            轻量版 3D 浏览器“我的世界”
          </p>
        </div>

        {/* Form Inputs Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>
              世界种子 (Seed)
            </label>
            <input
              type="text"
              className="custom-input"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="随机世界种子..."
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Slider
              label={`视距: ${renderDistance} 区块`}
              min={2}
              max={5}
              value={renderDistance}
              onChange={setRenderDistance}
              containerStyle={{ flex: 1 }}
            />

            <Slider
              label={`视野范围 (FOV): ${fov}°`}
              min={60}
              max={90}
              step={5}
              value={fov}
              onChange={setFov}
              containerStyle={{ flex: 1 }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <Button variant="primary" onClick={() => handleStart(false)}>
            <span>创建新世界</span>
          </Button>
          
          <Button
            variant="secondary"
            disabled={!hasSave}
            onClick={() => handleStart(true)}
            style={{
              opacity: hasSave ? 1 : 0.4,
              cursor: hasSave ? 'pointer' : 'not-allowed',
            }}
          >
            载入上次存档
          </Button>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '11px', color: '#475569', marginTop: '10px' }} className="pixel-text-sm">
          WASD 移动 | 鼠标视口旋转 | 左键破坏 | 右键放置 | 1-9 选择方块
        </div>
      </div>
    </div>
  );
};
