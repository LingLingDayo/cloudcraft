import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useGameStore } from '@store/useGameStore';
import { GameMode, type Language } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { Input } from '@components/common/Input';
import { Select } from '@components/common/Select';
import styles from './SettingsDialog.module.scss';

interface SettingsDialogProps {
  onClose: () => void;
}

type TabType = 'general' | 'graphics';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Load state and setters from store
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
  const autoJump = useGameStore((state) => state.autoJump);
  const setAutoJump = useGameStore((state) => state.setAutoJump);

  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('minicraft_player_name') || 'Steve';
  });

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('minicraft_player_name', name);
  };

  const gameModeOptions = [
    { label: t('pauseMenu.gameModeAdventure'), value: GameMode.ADVENTURE },
    { label: t('pauseMenu.gameModeCreative'), value: GameMode.CREATIVE },
  ];

  const tabs = [
    { id: 'general' as const, label: t('settings.general') },
    { id: 'graphics' as const, label: t('settings.graphics') },
  ];

  return (
    <div className={`settings-dialog-overlay ${styles.overlay}`}>
      <div className={`settings-dialog-container ${styles.container}`}>
        {/* Close Button at top-right */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Left grouping sidebar */}
        <div className={styles.sidebar}>
          <h2 className={`pixel-text-sm ${styles.sidebarTitle}`}>
            {t('settings.title')}
          </h2>
          <div className={styles.tabList}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`${styles.tabBtn} ${
                  activeTab === tab.id ? styles.activeTabBtn : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right content page */}
        <div className={styles.contentArea}>
          <div className={styles.tabPanel}>
            {activeTab === 'general' && (
              <div className={styles.settingsGroup}>
                <h3 className={`pixel-text-sm ${styles.groupTitle}`}>
                  {t('settings.general')}
                </h3>
                
                <div className={styles.optionItem}>
                  <Select
                    label={t('pauseMenu.language')}
                    value={language}
                    options={[
                      { label: '简体中文', value: 'zh' },
                      { label: 'English', value: 'en' },
                    ]}
                    onChange={(val) => setLanguage(val as Language)}
                  />
                </div>

                <div className={styles.optionItem}>
                  <Input
                    label={t('pauseMenu.playerName')}
                    value={playerName}
                    onChange={handlePlayerNameChange}
                    placeholder={t('pauseMenu.playerNamePlaceholder')}
                  />
                </div>

                <div className={styles.optionItem}>
                  <Select
                    label={t('pauseMenu.gameMode')}
                    value={gameMode}
                    options={gameModeOptions}
                    onChange={(val) => setGameMode(val as GameMode)}
                  />
                </div>

                <div className={styles.optionItem}>
                  <Switch
                    label={t('pauseMenu.autoJump')}
                    checked={autoJump}
                    onChange={(checked) => setAutoJump(checked)}
                  />
                </div>
              </div>
            )}

            {activeTab === 'graphics' && (
              <div className={styles.settingsGroup}>
                <h3 className={`pixel-text-sm ${styles.groupTitle}`}>
                  {t('settings.graphics')}
                </h3>

                <div className={styles.optionItem}>
                  <Switch
                    label={t('pauseMenu.debugOverlay')}
                    checked={debugOverlay}
                    onChange={(checked) => setDebugOverlay(checked)}
                  />
                </div>

                <div className={styles.optionItem}>
                  <Slider
                    label={t('pauseMenu.renderDistance')}
                    min={2}
                    max={5}
                    value={renderDistance}
                    onChange={setRenderDistance}
                    valueFormatter={(val) => t('pauseMenu.renderDistanceValue', { val })}
                  />
                </div>

                <div className={styles.optionItem}>
                  <Slider
                    label={t('pauseMenu.fov')}
                    min={60}
                    max={90}
                    step={5}
                    value={fov}
                    onChange={setFov}
                    valueFormatter={(val) => t('pauseMenu.fovValue', { val })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Done button */}
          <div className={styles.footer}>
            <Button variant="secondary" onClick={onClose}>
              {t('settings.done')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
