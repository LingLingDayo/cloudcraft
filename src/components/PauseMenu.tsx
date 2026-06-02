import React, { useState } from 'react';
import { sound } from '../game/Sound';
import type { PauseMenuProps } from '../types';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onSave,
  onQuit,
  renderDistance,
  onRenderDistanceChange,
  fov,
  onFovChange,
}) => {
  const [saveStatus, setSaveStatus] = useState<string>('保存世界');

  const handleResume = () => {
    sound.playClick();
    onResume();
  };

  const handleSave = () => {
    sound.playClick();
    onSave();
    setSaveStatus('已保存！');
    setTimeout(() => {
      setSaveStatus('保存世界');
    }, 1500);
  };

  const handleQuit = () => {
    sound.playClick();
    onQuit();
  };

  return (
    <div className="overlay-container">
      <div
        className="glass-panel"
        style={{
          width: '380px',
          padding: '36px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div>
          <h2
            className="pixel-text"
            style={{
              fontSize: '24px',
              color: '#f8fafc',
              margin: '0 0 4px 0',
            }}
          >
            游戏已暂停
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            点击“返回游戏”或点击画面继续
          </p>
        </div>

        {/* Buttons List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="btn-primary" onClick={handleResume}>
            返回游戏
          </button>
          
          <button className="btn-secondary" onClick={handleSave}>
            {saveStatus}
          </button>

          <button className="btn-danger" onClick={handleQuit}>
            保存并返回主菜单
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

        {/* Quick Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>
              视距: {renderDistance} 区块
            </label>
            <input
              type="range"
              min="2"
              max="5"
              step="1"
              style={{ accentColor: '#818cf8', cursor: 'pointer' }}
              value={renderDistance}
              onChange={(e) => onRenderDistanceChange(parseInt(e.target.value, 10))}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>
              视野范围 (FOV): {fov}°
            </label>
            <input
              type="range"
              min="60"
              max="90"
              step="5"
              style={{ accentColor: '#818cf8', cursor: 'pointer' }}
              value={fov}
              onChange={(e) => onFovChange(parseInt(e.target.value, 10))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
