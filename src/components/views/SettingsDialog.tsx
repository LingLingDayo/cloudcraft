/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@i18n';
import { useGameStore } from '@store/useGameStore';
import { GameMode, type Language } from '@type';
import { SettingsModal } from '@components/common/SettingsModal';
import type { SettingsConfig, SettingsPage } from '@components/common/SettingsModal/types';
import { SaveManager } from '@game/systems/SaveManager';
import { isMobileDevice, requestFullscreenAndLandscape, exitFullscreenAndUnlock, type FullscreenDocument } from '@utils/device';
import { getSystemSettings, saveSystemSetting } from '@utils/settings';
import styles from './SettingsDialog.module.scss';

interface SettingsDialogProps {
  onClose: () => void;
  closeOnBack?: boolean;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ 
  onClose, 
  closeOnBack = true
}) => {
  const { t } = useTranslation();

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

  useEffect(() => {
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
  const nightBrightness = useGameStore((state) => state.nightBrightness);
  const setNightBrightness = useGameStore((state) => state.setNightBrightness);

  const [playerName, setPlayerName] = useState<string>(() => {
    return getSystemSettings().playerName;
  });

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    saveSystemSetting('playerName', name);
  };

  // 装载合并数据对象供 SettingsModal 使用
  const settingsData = useMemo(() => ({
    language,
    playerName,
    gameMode,
    autoJump,
    fullscreen: isFullscreen,
    debugOverlay,
    showMinimap,
    renderDistance,
    fov,
    dpadSize,
    nightBrightness,
  }), [
    language,
    playerName,
    gameMode,
    autoJump,
    isFullscreen,
    debugOverlay,
    showMinimap,
    renderDistance,
    fov,
    dpadSize,
    nightBrightness,
  ]);

  // 分发具体更改到 Zustand & localStorage 中
  const handleUpdate = (updates: Partial<typeof settingsData>) => {
    if (updates.language !== undefined) {
      setLanguage(updates.language as Language);
    }
    if (updates.playerName !== undefined) {
      handlePlayerNameChange(updates.playerName);
    }
    if (updates.gameMode !== undefined) {
      setGameMode(updates.gameMode);
    }
    if (updates.autoJump !== undefined) {
      setAutoJump(updates.autoJump);
    }
    if (updates.fullscreen !== undefined) {
      toggleFullscreen(updates.fullscreen);
    }
    if (updates.debugOverlay !== undefined) {
      setDebugOverlay(updates.debugOverlay);
    }
    if (updates.showMinimap !== undefined) {
      setShowMinimap(updates.showMinimap);
    }
    if (updates.renderDistance !== undefined) {
      setRenderDistance(updates.renderDistance);
    }
    if (updates.fov !== undefined) {
      setFov(updates.fov);
    }
    if (updates.dpadSize !== undefined) {
      setDpadSize(updates.dpadSize);
    }
    if (updates.nightBrightness !== undefined) {
      setNightBrightness(updates.nightBrightness);
    }
  };

  // 声明式的配置，分为常规、图像与控制三大 Pages
  const settingsConfig: SettingsConfig<typeof settingsData> = useMemo(() => {
    const pages: SettingsPage<typeof settingsData>[] = [
      {
        id: 'general',
        title: t('settings.general'),
        groups: [
          {
            id: 'generalGroup',
            title: t('settings.general'),
            controls: [
              {
                key: 'language',
                label: t('pauseMenu.language'),
                type: 'select',
                options: [
                  { label: '简体中文', value: 'zh' },
                  { label: 'English', value: 'en' },
                ],
              },
              {
                key: 'playerName',
                label: t('pauseMenu.playerName'),
                type: 'text',
                placeholder: t('pauseMenu.playerNamePlaceholder'),
              },
              {
                key: 'gameMode',
                label: t('pauseMenu.gameMode'),
                type: 'select',
                options: [
                  { label: t('pauseMenu.gameModeAdventure'), value: GameMode.ADVENTURE },
                  { label: t('pauseMenu.gameModeCreative'), value: GameMode.CREATIVE },
                ],
              },
              {
                key: 'autoJump',
                label: t('pauseMenu.autoJump'),
                type: 'boolean',
              },
            ],
          },
        ],
      },
      {
        id: 'graphics',
        title: t('settings.graphics'),
        groups: [
          {
            id: 'graphicsGroup',
            title: t('settings.graphics'),
            controls: [
              {
                key: 'fullscreen',
                label: t('settings.fullscreen'),
                type: 'boolean',
              },
              {
                key: 'debugOverlay',
                label: t('pauseMenu.debugOverlay'),
                type: 'boolean',
              },
              {
                key: 'showMinimap',
                label: t('hud.minimap'),
                type: 'boolean',
              },
              {
                key: 'renderDistance',
                label: t('pauseMenu.renderDistance'),
                type: 'slider',
                min: 2,
                max: 10,
                step: 1,
                valueFormatter: (val) => t('pauseMenu.renderDistanceValue', { val }),
              },
              {
                key: 'fov',
                label: t('pauseMenu.fov'),
                type: 'slider',
                min: 60,
                max: 90,
                step: 5,
                valueFormatter: (val) => t('pauseMenu.fovValue', { val }),
              },
              {
                key: 'nightBrightness',
                label: t('settings.nightBrightness'),
                type: 'slider',
                min: 0.1,
                max: 2.0,
                step: 0.1,
                valueFormatter: (val) => t('settings.nightBrightnessValue', { val: Number(val).toFixed(1) }),
              },
            ],
          },
        ],
      },
      {
        id: 'controls',
        title: t('settings.controlsTitle'),
        groups: [
          {
            id: 'controlsGroup',
            title: t('settings.controlsTitle'),
            controls: [
              ...(isMobileDevice()
                ? [
                    {
                      key: 'dpadSize',
                      label: t('settings.dpadSize'),
                      type: 'slider',
                      min: 120,
                      max: 240,
                      step: 10,
                      valueFormatter: (val: any) => t('settings.dpadSizeValue', { val }),
                    } as any,
                  ]
                : []),
              {
                key: 'keybindings',
                type: 'ui-custom',
                render: () => (
                  <div className={styles.controlsGrid}>
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
                ),
              },
            ],
          },
        ],
      },
    ];
    return { pages };
  }, [t]);

  return (
    <SettingsModal
      isOpen={true}
      title={t('settings.title')}
      data={settingsData}
      settingsConfig={settingsConfig}
      context={null}
      isLiveUpdate={true}
      isShowReset={false}
      styleMode="classic"
      closeOnBack={closeOnBack}
      sidebarFooter={
        <div className={styles.versionInfo}>
          {t('settings.version', { version: SaveManager.GAME_VERSION })}
        </div>
      }
      onUpdate={handleUpdate}
      onClose={onClose}
    />
  );
};
