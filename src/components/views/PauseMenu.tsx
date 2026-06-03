import React, { useState, useEffect } from 'react';
import type { PauseMenuProps } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { Input } from '@components/common/Input';
import { Select } from '@components/common/Select';
import { Dialog } from '@components/common/Dialog';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '../../i18n';
import styles from './PauseMenu.module.scss';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onSave,
  onQuit,
}) => {
  const { t } = useTranslation();
  const [saveStatusKey, setSaveStatusKey] = useState<'save' | 'saved'>('save');
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
  const language = useGameStore((state) => state.language);
  const setLanguage = useGameStore((state) => state.setLanguage);

  const handleSave = () => {
    onSave();
    setSaveStatusKey('saved');
    setTimeout(() => {
      setSaveStatusKey('save');
    }, 1500);
  };

  const gameModeOptions = [
    { label: t('pauseMenu.gameModeAdventure'), value: 'adventure' },
    { label: t('pauseMenu.gameModeCreative'), value: 'creative' },
  ];

  return (
    <Dialog 
      title={t('pauseMenu.title')} 
      onClose={onResume} 
      width={400}
    >
      <div className={styles.content}>
        <p className={styles.description}>
          {t('pauseMenu.description')}
        </p>

        {/* Buttons List */}
        <div className={styles.buttonList}>
          <Button variant="primary" onClick={onResume}>
            {t('pauseMenu.resume')}
          </Button>
          
          <Button variant="secondary" onClick={handleSave}>
            {t(`pauseMenu.${saveStatusKey}`)}
          </Button>

          <Button variant="danger" onClick={onQuit}>
            {t('pauseMenu.quit')}
          </Button>
        </div>

        <hr className={styles.divider} />

        {/* Quick Settings */}
        <div className={styles.settingsList}>
          {/* Language Select */}
          <Select
            label={t('pauseMenu.language')}
            value={language}
            options={[
              { label: '简体中文', value: 'zh' },
              { label: 'English', value: 'en' },
            ]}
            onChange={(val) => setLanguage(val as 'zh' | 'en')}
          />

          {/* Player Name Input */}
          <Input
            label={t('pauseMenu.playerName')}
            value={playerName}
            onChange={setPlayerName}
            placeholder={t('pauseMenu.playerNamePlaceholder')}
          />

          {/* Game Mode Select */}
          <Select
            label={t('pauseMenu.gameMode')}
            value={gameMode}
            options={gameModeOptions}
            onChange={(val) => setGameMode(val)}
          />

          {/* Debug Switch */}
          <Switch
            label={t('pauseMenu.debugOverlay')}
            checked={debugOverlay}
            onChange={(checked) => setDebugOverlay(checked)}
          />

          {/* Render Distance Slider */}
          <Slider
            label={t('pauseMenu.renderDistance', { val: renderDistance })}
            min={2}
            max={5}
            value={renderDistance}
            onChange={setRenderDistance}
          />

          {/* FOV Slider */}
          <Slider
            label={t('pauseMenu.fov', { val: fov })}
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
