import React, { useState } from 'react';
import type { StartMenuProps } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { Input } from '@components/common/Input';
import { useGameStore } from '@store/useGameStore';
import styles from './StartMenu.module.scss';

const SLIDER_CONTAINER_STYLE = { flex: 1 };

const DARK_LABEL_STYLE: React.CSSProperties = {
  color: '#e0e0e0',
  textShadow: '2px 2px 0px #000000',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: '10px',
  fontWeight: 'normal',
};

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
    <div className={styles.menuBg}>
      <div className={styles.panel}>
        <div className={styles.titleContainer}>
          {/* Pulsing Pixel Title with Splash */}
          <div className={styles.splashContainer}>
            <h1 className={`pixel-text ${styles.title}`}>
              MINICRAFT
            </h1>
            <span className={`pixel-text-sm ${styles.splashText}`}>
              Web Edition!
            </span>
          </div>
          <p className={styles.subtitle}>
            轻量版 3D 浏览器“我的世界”
          </p>
        </div>

        {/* Form Inputs Container */}
        <div className={styles.formContainer}>
          <Input
            label="世界种子 (Seed)"
            value={seed}
            onChange={setSeed}
            placeholder="随机世界种子..."
            labelStyle={DARK_LABEL_STYLE}
          />

          <div className={styles.slidersRow}>
            <Slider
              label={`视距: ${renderDistance} 区块`}
              min={2}
              max={5}
              value={renderDistance}
              onChange={setRenderDistance}
              containerStyle={SLIDER_CONTAINER_STYLE}
              labelStyle={DARK_LABEL_STYLE}
            />

            <Slider
              label={`视野范围 (FOV): ${fov}°`}
              min={60}
              max={90}
              step={5}
              value={fov}
              onChange={setFov}
              containerStyle={SLIDER_CONTAINER_STYLE}
              labelStyle={DARK_LABEL_STYLE}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Switch
              label="创造模式 (Creative Mode)"
              checked={gameMode === 'creative'}
              onChange={(checked) => setGameMode(checked ? 'creative' : 'adventure')}
              containerStyle={{ flex: 1 }}
              labelStyle={DARK_LABEL_STYLE}
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


