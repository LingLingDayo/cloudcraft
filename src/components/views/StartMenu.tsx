import React, { useState } from 'react';
import type { StartMenuProps } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { useGameStore } from '@store/useGameStore';
import styles from './StartMenu.module.scss';

const SLIDER_CONTAINER_STYLE = { flex: 1 };

export const StartMenu: React.FC<StartMenuProps> = ({ onStartGame }) => {
  const [seed, setSeed] = useState<string>(() => Math.floor(Math.random() * 999999).toString());
  const [renderDistance, setRenderDistance] = useState<number>(() => useGameStore.getState().renderDistance);
  const [fov, setFov] = useState<number>(() => useGameStore.getState().fov);
  const [hasSave] = useState<boolean>(() => !!localStorage.getItem('minicraft_save'));

  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);

  const handleStart = (loadSave: boolean) => {
    onStartGame(seed, renderDistance, fov, loadSave);
  };

  return (
    <div className="menu-bg">
      <div className={`glass-panel ${styles.panel}`}>
        <div>
          {/* Pulsing Pixel Title */}
          <h1 className={`pixel-text ${styles.title}`}>
            MINICRAFT
          </h1>
          <p className={styles.subtitle}>
            轻量版 3D 浏览器“我的世界”
          </p>
        </div>

        {/* Form Inputs Container */}
        <div className={styles.formContainer}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>
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

          <div className={styles.slidersRow}>
            <Slider
              label={`视距: ${renderDistance} 区块`}
              min={2}
              max={5}
              value={renderDistance}
              onChange={setRenderDistance}
              containerStyle={SLIDER_CONTAINER_STYLE}
            />

            <Slider
              label={`视野范围 (FOV): ${fov}°`}
              min={60}
              max={90}
              step={5}
              value={fov}
              onChange={setFov}
              containerStyle={SLIDER_CONTAINER_STYLE}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Switch
              label="创造模式 (Creative Mode)"
              checked={gameMode === 'creative'}
              onChange={(checked) => setGameMode(checked ? 'creative' : 'adventure')}
              containerStyle={{ flex: 1 }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className={styles.buttonContainer}>
          <Button variant="primary" onClick={() => handleStart(false)}>
            <span>创建新世界</span>
          </Button>
          
          <Button
            variant="secondary"
            disabled={!hasSave}
            onClick={() => handleStart(true)}
            className={styles.loadSaveButton}
          >
            载入上次存档
          </Button>
        </div>

        {/* Footer */}
        <div className={`pixel-text-sm ${styles.footer}`}>
          WASD 移动 | 鼠标视口旋转 | 左键破坏 | 右键放置 | 1-9 选择方块
        </div>
      </div>
    </div>
  );
};

