import React, { useState, useEffect } from 'react';
import { sound } from '../game/Sound';

interface StartMenuProps {
  onStartGame: (seed: string, renderDistance: number, fov: number, loadSave: boolean) => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({ onStartGame }) => {
  const [seed, setSeed] = useState<string>('');
  const [renderDistance, setRenderDistance] = useState<number>(3);
  const [fov, setFov] = useState<number>(75);
  const [hasSave, setHasSave] = useState<boolean>(false);

  useEffect(() => {
    // Check if there is an existing world save
    const save = localStorage.getItem('minicraft_save');
    setHasSave(!!save);
    
    // Seed with a random value on mount
    setSeed(Math.floor(Math.random() * 999999).toString());
  }, []);

  const handleStart = (loadSave: boolean) => {
    sound.playClick();
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>
                视距: {renderDistance} 区块
              </label>
              <input
                type="range"
                min="2"
                max="5"
                step="1"
                style={{ accentColor: '#818cf8', cursor: 'pointer' }}
                value={renderDistance}
                onChange={(e) => setRenderDistance(parseInt(e.target.value, 10))}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>
                视野范围 (FOV): {fov}°
              </label>
              <input
                type="range"
                min="60"
                max="90"
                step="5"
                style={{ accentColor: '#818cf8', cursor: 'pointer' }}
                value={fov}
                onChange={(e) => setFov(parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <button className="btn-primary" onClick={() => handleStart(false)}>
            <span>创建新世界</span>
          </button>
          
          <button
            className="btn-secondary"
            disabled={!hasSave}
            onClick={() => handleStart(true)}
            style={{
              opacity: hasSave ? 1 : 0.4,
              cursor: hasSave ? 'pointer' : 'not-allowed',
            }}
          >
            载入上次存档
          </button>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '11px', color: '#475569', marginTop: '10px' }} className="pixel-text-sm">
          WASD 移动 | 鼠标视口旋转 | 左键破坏 | 右键放置 | 1-9 选择方块
        </div>
      </div>
    </div>
  );
};
