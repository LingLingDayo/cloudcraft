import React, { useState, useRef, useEffect } from 'react';
import { type StartMenuProps, GameMode } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { Input } from '@components/common/Input';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '../../i18n';
import { SaveManager } from '@game/systems/SaveManager';
import styles from './StartMenu.module.scss';

const SLIDER_CONTAINER_STYLE = { flex: 1 };

const getLabelStyle = (language: 'zh' | 'en'): React.CSSProperties => ({
  color: '#e0e0e0',
  textShadow: '2px 2px 0px #000000',
  fontFamily: language === 'zh'
    ? "'Outfit', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    : "'Press Start 2P', monospace",
  fontSize: language === 'zh' ? '12px' : '10px',
  fontWeight: language === 'zh' ? 'bold' : 'normal',
});

export const StartMenu: React.FC<StartMenuProps> = ({ onStartGame }) => {
  const { t, language } = useTranslation();
  const labelStyle = getLabelStyle(language);

  const [seed, setSeed] = useState<string>(() => Math.floor(Math.random() * 999999).toString());
  const [renderDistance, setRenderDistance] = useState<number>(() => useGameStore.getState().renderDistance);
  const [fov, setFov] = useState<number>(() => useGameStore.getState().fov);
  const [hasSave, setHasSave] = useState<boolean>(false);

  useEffect(() => {
    SaveManager.getSave('default_world').then((save) => {
      setHasSave(!!save);
    }).catch((err) => {
      console.error('Failed to check save state:', err);
    });
  }, []);

  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportSave = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Basic validation of save data structure
        if (!parsed || typeof parsed !== 'object' || !parsed.world) {
          alert(t('startMenu.invalidSaveFile'));
          return;
        }

        // Save it using SaveManager
        SaveManager.saveGame('default_world', parsed, t('startMenu.defaultWorldName'))
          .then(() => {
            // Update state
            setHasSave(true);
            alert(t('startMenu.importSuccess'));
          })
          .catch((err) => {
            console.error(err);
            alert(t('startMenu.importFailed'));
          });
      } catch (err) {
        console.error(err);
        alert(t('startMenu.parseFailed'));
      }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be selected again
    event.target.value = '';
  };

  const handleStart = (loadSave: boolean) => {
    // Attempt to enter fullscreen on mobile devices (requires user activation)
    interface FullscreenHTMLElement extends HTMLElement {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    }
    const docEl = document.documentElement as FullscreenHTMLElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch((err: unknown) => {
        console.warn('Failed to enter fullscreen:', err);
      });
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      docEl.mozRequestFullScreen();
    } else if (docEl.msRequestFullscreen) {
      docEl.msRequestFullscreen();
    }

    onStartGame(seed, renderDistance, fov, loadSave);
  };

  return (
    <div className={styles.menuBg}>
      <div className={styles.panel}>
        <div className={styles.titleContainer}>
          {/* Pulsing Pixel Title with Splash */}
          <div className={styles.splashContainer}>
            <h1 className={`pixel-text ${styles.title}`}>
              {t('startMenu.title')}
            </h1>
            <span className={`pixel-text-sm ${styles.splashText}`}>
              Web Edition!
            </span>
          </div>
          <p className={styles.subtitle}>
            {t('startMenu.subtitle')}
          </p>
        </div>

        {/* Form Inputs Container */}
        <div className={styles.formContainer}>
          <Input
            label={t('startMenu.seedLabel')}
            value={seed}
            onChange={setSeed}
            placeholder={t('startMenu.seedPlaceholder')}
            labelStyle={labelStyle}
          />

          <div className={styles.slidersRow}>
            <Slider
              label={t('startMenu.renderDistance')}
              min={2}
              max={5}
              value={renderDistance}
              onChange={setRenderDistance}
              valueFormatter={(val) => t('startMenu.renderDistanceValue', { val })}
              containerStyle={SLIDER_CONTAINER_STYLE}
              labelStyle={labelStyle}
            />

            <Slider
              label={t('startMenu.fov')}
              min={60}
              max={90}
              step={5}
              value={fov}
              onChange={setFov}
              valueFormatter={(val) => t('startMenu.fovValue', { val })}
              containerStyle={SLIDER_CONTAINER_STYLE}
              labelStyle={labelStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Switch
              label={t('startMenu.creativeMode')}
              checked={gameMode === GameMode.CREATIVE}
              onChange={(checked) => setGameMode(checked ? GameMode.CREATIVE : GameMode.ADVENTURE)}
              containerStyle={{ flex: 1 }}
              labelStyle={labelStyle}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className={styles.buttonContainer}>
          <Button variant="primary" onClick={() => handleStart(false)}>
            <span>{t('startMenu.createWorld')}</span>
          </Button>
          
          <Button
            variant="secondary"
            disabled={!hasSave}
            onClick={() => handleStart(true)}
            className={styles.loadSaveButton}
          >
            {t('startMenu.loadSave')}
          </Button>

          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <span>{t('startMenu.importSave')}</span>
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleImportSave}
          />
        </div>
      </div>
    </div>
  );
};


