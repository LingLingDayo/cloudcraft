import React, { useState } from 'react';
import type { PauseMenuProps } from '../../types';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { useGameStore } from '../../store/useGameStore';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onSave,
  onQuit,
}) => {
  const [saveStatus, setSaveStatus] = useState<string>('保存世界');
  
  const renderDistance = useGameStore((state) => state.renderDistance);
  const setRenderDistance = useGameStore((state) => state.setRenderDistance);
  const fov = useGameStore((state) => state.fov);
  const setFov = useGameStore((state) => state.setFov);

  const handleSave = () => {
    onSave();
    setSaveStatus('已保存！');
    setTimeout(() => {
      setSaveStatus('保存世界');
    }, 1500);
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
          <Button variant="primary" onClick={onResume}>
            返回游戏
          </Button>
          
          <Button variant="secondary" onClick={handleSave}>
            {saveStatus}
          </Button>

          <Button variant="danger" onClick={onQuit}>
            保存并返回主菜单
          </Button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

        {/* Quick Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <Slider
            label={`视距: ${renderDistance} 区块`}
            min={2}
            max={5}
            value={renderDistance}
            onChange={setRenderDistance}
            labelStyle={{ fontSize: '11px' }}
            containerStyle={{ gap: '4px' }}
          />

          <Slider
            label={`视野范围 (FOV): ${fov}°`}
            min={60}
            max={90}
            step={5}
            value={fov}
            onChange={setFov}
            labelStyle={{ fontSize: '11px' }}
            containerStyle={{ gap: '4px' }}
          />
        </div>
      </div>
    </div>
  );
};
