import React, { useState } from 'react';
import { useTranslation } from '@i18n';
import { useGameStore } from '@store/useGameStore';
import { GameMode, type Language } from '@type';
import { Button } from '@components/common/Button';
import { Slider } from '@components/common/Slider';
import { Switch } from '@components/common/Switch';
import { Input } from '@components/common/Input';
import { Select } from '@components/common/Select';
import { SaveManager } from '@game/systems/SaveManager';
import { isMobileDevice, requestFullscreenAndLandscape, exitFullscreenAndUnlock } from '@utils/device';
import { useBackToClose } from '@hooks/useBackToClose';
import { getSystemSettings, saveSystemSetting } from '@utils/settings';
import styles from './SettingsDialog.module.scss';

interface SettingsDialogProps {
  onClose: () => void;
  onSave?: () => void;
  closeOnBack?: boolean;
}

type TabType = 'general' | 'graphics' | 'controls';

interface FullscreenDocument extends Document {
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ 
  onClose, 
  onSave,
  closeOnBack = true
}) => {
  useBackToClose({ onClose, enabled: closeOnBack });
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Fullscreen state and event listeners to keep state in sync
  const [isFullscreen, setIsFullscreen] = useState(() => {
    const doc = document as FullscreenDocument;
    return !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  });

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as FullscreenDocument;
      setIsFullscreen(
        !!(
          doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
        )
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = (checked: boolean) => {
    if (import.meta.env.DEV) {
      console.warn('[DEV] Fullscreen toggle ignored in development environment.');
      return;
    }
    if (checked) {
      requestFullscreenAndLandscape().catch((err: unknown) => console.warn('Failed to enter fullscreen:', err));
    } else {
      exitFullscreenAndUnlock().catch((err: unknown) => console.warn('Failed to exit fullscreen:', err));
    }
  };


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
  const dpadSize = useGameStore((state) => state.dpadSize);
  const setDpadSize = useGameStore((state) => state.setDpadSize);
  const showMinimap = useGameStore((state) => state.showMinimap);
  const setShowMinimap = useGameStore((state) => state.setShowMinimap);

  const [playerName, setPlayerName] = useState<string>(() => {
    return getSystemSettings().playerName;
  });

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    saveSystemSetting('playerName', name);
  };

  const handleExport = async () => {
    if (onSave) {
      try {
        await onSave();
      } catch (err) {
        console.error('Failed to auto-save before export:', err);
      }
    }
    try {
      const saveData = await SaveManager.getSave('default_world');
      if (!saveData) {
        alert(t('settings.noSaveData'));
        return;
      }
      const saveDataStr = JSON.stringify(saveData);
      const blob = new Blob([saveDataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `minicraft_save_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(t('settings.exportFailed'));
    }
  };

  const gameModeOptions = [
    { label: t('pauseMenu.gameModeAdventure'), value: GameMode.ADVENTURE },
    { label: t('pauseMenu.gameModeCreative'), value: GameMode.CREATIVE },
  ];

  const tabs = [
    { id: 'general' as const, label: t('settings.general') },
    { id: 'graphics' as const, label: t('settings.graphics') },
    { id: 'controls' as const, label: t('settings.controls') },
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
          
          <div className={styles.versionInfo}>
            {t('settings.version', { version: '0.1.0' })}
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

                <div className={styles.optionItem}>
                  <span className={styles.label} style={{ marginBottom: '8px' }}>
                    {t('settings.saveData')}
                  </span>
                  <Button variant="secondary" onClick={handleExport}>
                    {t('settings.exportSave')}
                  </Button>
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
                    label={t('settings.fullscreen')}
                    checked={isFullscreen}
                    onChange={toggleFullscreen}
                  />
                </div>

                <div className={styles.optionItem}>
                  <Switch
                    label={t('pauseMenu.debugOverlay')}
                    checked={debugOverlay}
                    onChange={(checked) => setDebugOverlay(checked)}
                  />
                </div>

                <div className={styles.optionItem}>
                  <Switch
                    label={t('hud.minimap')}
                    checked={showMinimap}
                    onChange={(checked) => setShowMinimap(checked)}
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

            {activeTab === 'controls' && (
              <div className={styles.settingsGroup}>
                <h3 className={`pixel-text-sm ${styles.groupTitle}`}>
                  {t('settings.controlsTitle')}
                </h3>

                <div className={styles.controlsGrid}>
                  {/* Mobile Section */}
                  {isMobileDevice() && (
                    <div className={styles.controlSection} style={{ marginBottom: '12px' }}>
                      <h4 className={`pixel-text-sm ${styles.sectionTitle}`}>
                        {t('settings.mobileControls')}
                      </h4>
                      <div className={styles.optionItem}>
                        <Slider
                          label={t('settings.dpadSize')}
                          min={120}
                          max={240}
                          step={10}
                          value={dpadSize}
                          onChange={setDpadSize}
                          valueFormatter={(val) => t('settings.dpadSizeValue', { val })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Keyboard Section */}
                  <div className={styles.controlSection}>
                    <h4 className={`pixel-text-sm ${styles.sectionTitle}`}>
                      {t('controls.keyboard')}
                    </h4>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.moveForward')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>W</kbd>
                        <span className={styles.keySeparator}>/</span>
                        <kbd className={styles.kbd}>↑</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.moveBackward')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>S</kbd>
                        <span className={styles.keySeparator}>/</span>
                        <kbd className={styles.kbd}>↓</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.moveLeft')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>A</kbd>
                        <span className={styles.keySeparator}>/</span>
                        <kbd className={styles.kbd}>←</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.moveRight')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>D</kbd>
                        <span className={styles.keySeparator}>/</span>
                        <kbd className={styles.kbd}>→</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.jump')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>Space</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.sneak')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>Shift</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.openInventory')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>E</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.toggleDebug')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>F3</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.toggleFly')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>F4</kbd>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.hotbar')}</span>
                      <div className={styles.controlKeys}>
                        <kbd className={styles.kbd}>1</kbd>
                        <span className={styles.keySeparator}>-</span>
                        <kbd className={styles.kbd}>9</kbd>
                      </div>
                    </div>
                  </div>

                  {/* Mouse Section */}
                  <div className={styles.controlSection}>
                    <h4 className={`pixel-text-sm ${styles.sectionTitle}`}>
                      {t('controls.mouse')}
                    </h4>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.mouseMove')}</span>
                      <div className={styles.controlKeys}>
                        <span className={styles.mouseAction}>{t('controls.mouseMoveAction')}</span>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.leftClick')}</span>
                      <div className={styles.controlKeys}>
                        <span className={styles.mouseAction}>{t('controls.leftClickAction')}</span>
                      </div>
                    </div>

                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>{t('controls.rightClick')}</span>
                      <div className={styles.controlKeys}>
                        <span className={styles.mouseAction}>{t('controls.rightClickAction')}</span>
                      </div>
                    </div>
                  </div>
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
