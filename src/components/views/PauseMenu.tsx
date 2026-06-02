import React, { useState } from 'react';
import type { PauseMenuProps } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { useGameStore } from '@store/useGameStore';
import styles from './PauseMenu.module.scss';

// Styles for sliders to avoid inline styling in JSX
const SLIDER_LABEL_STYLE = { fontSize: '11px' };
const SLIDER_CONTAINER_STYLE = { gap: '4px' };

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
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);


  const handleSave = () => {
    onSave();
    setSaveStatus('已保存！');
    setTimeout(() => {
      setSaveStatus('保存世界');
    }, 1500);
  };

  return (
    <div className="overlay-container">
      <div className={`glass-panel ${styles.panel}`}>
        <div>
          <h2 className={`pixel-text ${styles.title}`}>
            游戏已暂停
          </h2>
          <p className={styles.description}>
            点击“返回游戏”或点击画面继续
          </p>
        </div>

        {/* Buttons List */}
        <div className={styles.buttonList}>
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

        <hr className={styles.divider} />

        {/* Quick Settings */}
        <div className={styles.settingsList}>
          <Switch
            label="创造模式 (Creative Mode)"
            checked={gameMode === 'creative'}
            onChange={(checked) => setGameMode(checked ? 'creative' : 'adventure')}
            labelStyle={SLIDER_LABEL_STYLE}
            containerStyle={SLIDER_CONTAINER_STYLE}
          />

          <Slider
            label={`视距: ${renderDistance} 区块`}
            min={2}
            max={5}
            value={renderDistance}
            onChange={setRenderDistance}
            labelStyle={SLIDER_LABEL_STYLE}
            containerStyle={SLIDER_CONTAINER_STYLE}
          />

          <Slider
            label={`视野范围 (FOV): ${fov}°`}
            min={60}
            max={90}
            step={5}
            value={fov}
            onChange={setFov}
            labelStyle={SLIDER_LABEL_STYLE}
            containerStyle={SLIDER_CONTAINER_STYLE}
          />
        </div>
      </div>
    </div>
  );
};


