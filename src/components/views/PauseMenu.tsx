import React, { useState, useEffect } from 'react';
import type { PauseMenuProps } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { Input } from '@components/common/Input';
import { Select } from '@components/common/Select';
import { Dialog } from '@components/common/Dialog';
import { useGameStore } from '@store/useGameStore';
import styles from './PauseMenu.module.scss';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onSave,
  onQuit,
}) => {
  const [saveStatus, setSaveStatus] = useState<string>('保存世界');
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('minicraft_player_name') || 'Steve';
  });

  useEffect(() => {
    localStorage.setItem('minicraft_player_name', playerName);
  }, [playerName]);

  const renderDistance = useGameStore((state) => state.renderDistance);
  const setRenderDistance = useGameStore((state) => state.setRenderDistance);
  const fov = useGameStore((state) => state.fov);
  const setFov = useGameStore((state) => state.setFov);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const debugOverlay = useGameStore((state) => state.debugOverlay);
  const setDebugOverlay = useGameStore((state) => state.setDebugOverlay);

  const handleSave = () => {
    onSave();
    setSaveStatus('已保存！');
    setTimeout(() => {
      setSaveStatus('保存世界');
    }, 1500);
  };

  const gameModeOptions = [
    { label: '冒险模式 (Adventure)', value: 'adventure' },
    { label: '创造模式 (Creative)', value: 'creative' },
  ];

  return (
    <Dialog 
      title="游戏已暂停" 
      onClose={onResume} 
      width={400}
    >
      <div className={styles.content}>
        <p className={styles.description}>
          点击“返回游戏”或点击画面继续
        </p>

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
          {/* Player Name Input */}
          <Input
            label="玩家名称 (Name)"
            value={playerName}
            onChange={setPlayerName}
            placeholder="请输入玩家名称..."
          />

          {/* Game Mode Select */}
          <Select
            label="游戏模式 (Game Mode)"
            value={gameMode}
            options={gameModeOptions}
            onChange={(val) => setGameMode(val)}
          />

          {/* Debug Switch */}
          <Switch
            label="调试信息 (Debug Info)"
            checked={debugOverlay}
            onChange={(checked) => setDebugOverlay(checked)}
          />

          {/* Render Distance Slider */}
          <Slider
            label={`视距: ${renderDistance} 区块`}
            min={2}
            max={5}
            value={renderDistance}
            onChange={setRenderDistance}
          />

          {/* FOV Slider */}
          <Slider
            label={`视野范围 (FOV): ${fov}°`}
            min={60}
            max={90}
            step={5}
            value={fov}
            onChange={setFov}
          />
        </div>
      </div>
    </Dialog>
  );
};
