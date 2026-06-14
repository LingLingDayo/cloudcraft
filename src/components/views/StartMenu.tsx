import React, { useState, useRef, useEffect } from 'react';
import { type StartMenuProps, GameMode } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { Input } from '@components/common/Input';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '@i18n';
import { SaveManager, type SaveData } from '@game/systems/SaveManager';
import { requestFullscreenAndLandscape } from '@utils/device';
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
  const [saveSeed, setSaveSeed] = useState<string | null>(null);

  useEffect(() => {
    SaveManager.getSave('default_world').then((save) => {
      setHasSave(!!save);
      if (save) {
        if (save.seed) {
          setSaveSeed(save.seed);
        } else if (save.world) {
          try {
            const worldObj = JSON.parse(save.world);
            if (worldObj && worldObj.seed) {
              setSaveSeed(String(worldObj.seed));
            }
          } catch (e) {
            console.warn('Failed to parse seed from saved world string:', e);
          }
        }
      }
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
        
        if (!parsed || typeof parsed !== 'object') {
          alert(t('startMenu.invalidSaveFile'));
          return;
        }

        let worldDataStr = '';
        let finalSaveData: Omit<SaveData, 'createdAt'>;
        let importedSeed = seed;

        if ('world' in parsed) {
          // Full save file format
          const rawWorld = parsed.world;
          if (typeof rawWorld === 'string') {
            worldDataStr = rawWorld;
          } else if (typeof rawWorld === 'object' && rawWorld !== null) {
            worldDataStr = JSON.stringify(rawWorld);
          } else {
            alert(t('startMenu.invalidSaveFile'));
            return;
          }

          // Try to extract seed from worldDataStr
          try {
            const worldObj = JSON.parse(worldDataStr);
            if (worldObj && worldObj.seed) {
              importedSeed = String(worldObj.seed);
            }
          } catch (err) {
            console.warn('Failed to parse seed from world data string:', err);
          }

          finalSaveData = {
            world: worldDataStr,
            player: parsed.player || { x: 0, y: 0, z: 0 },
            hotbar: Array.isArray(parsed.hotbar) ? parsed.hotbar : Array(9).fill(null),
            inventory: Array.isArray(parsed.inventory) ? parsed.inventory : Array(54).fill(null),
            activeSlot: typeof parsed.activeSlot === 'number' ? parsed.activeSlot : 0,
            gameMode: parsed.gameMode || GameMode.ADVENTURE,
            version: parsed.version || SaveManager.GAME_VERSION,
          };
        } else if ('seed' in parsed || 'modified' in parsed || 'entities' in parsed) {
          // Raw world data format
          worldDataStr = JSON.stringify(parsed);
          if (parsed.seed) {
            importedSeed = String(parsed.seed);
          }

          finalSaveData = {
            world: worldDataStr,
            player: { x: 0, y: 0, z: 0 },
            hotbar: Array(9).fill(null),
            inventory: Array(54).fill(null),
            activeSlot: 0,
            gameMode: GameMode.ADVENTURE,
            version: SaveManager.GAME_VERSION,
          };
        } else {
          alert(t('startMenu.invalidSaveFile'));
          return;
        }

        // Save it using SaveManager
        SaveManager.saveGame('default_world', finalSaveData, t('startMenu.defaultWorldName'))
          .then(() => {
            // Update state
            setHasSave(true);
            setSeed(importedSeed);
            alert(t('startMenu.importSuccess'));
            // Automatically start the game with the imported save and correct seed
            handleStart(true, importedSeed);
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

  const handleStart = (loadSave: boolean, customSeed?: string) => {
    // Attempt to lock pointer immediately on document.body during the user gesture.
    // This will later be transferred to the canvas when the game loads.
    try {
      document.body.requestPointerLock();
    } catch (err) {
      console.warn('Failed to request initial pointer lock on document.body:', err);
    }

    // Attempt to enter fullscreen (requires user activation)
    // Avoid triggering fullscreen and orientation lock in dev environments completely
    if (!import.meta.env.DEV) {
      requestFullscreenAndLandscape().catch((err: unknown) => {
        console.warn('Failed to enter fullscreen and landscape:', err);
      });
    }

    onStartGame(customSeed !== undefined ? customSeed : seed, renderDistance, fov, loadSave);
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
              {t('startMenu.splashText')}
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
              max={10}
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
            onClick={() => handleStart(true, saveSeed || undefined)}
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


