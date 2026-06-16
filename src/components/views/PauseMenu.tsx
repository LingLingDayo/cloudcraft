import React, { useState, useRef, useEffect } from 'react';
import type { PauseMenuProps } from '@type';
import { Button } from '@components/common/Button';
import { Dialog } from '@components/common/Dialog';
import { useTranslation } from '@i18n';
import { SettingsDialog } from './SettingsDialog';
import { useGameStore } from '@store/useGameStore';
import { SaveManager } from '@game/systems/SaveManager';
import styles from './PauseMenu.module.scss';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onSave,
  onQuit,
}) => {
  const { t } = useTranslation();
  const [saveStatusKey, setSaveStatusKey] = useState<'save' | 'saved'>('save');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const isSettingsOpen = useGameStore((state) => state.isSettingsOpen);
  const setIsSettingsOpen = useGameStore((state) => state.setIsSettingsOpen);
  const settingsSource = useGameStore((state) => state.settingsSource);

  useEffect(() => {
    const ref = saveTimeoutRef;
    return () => {
      if (ref.current) {
        clearTimeout(ref.current);
      }
    };
  }, []);

  const handleSave = () => {
    onSave();
    setSaveStatusKey('saved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatusKey('save');
    }, 1500);
  };

  const handleExport = async () => {
    try {
      await onSave();
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
      link.download = `cloudcraft_save_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(t('settings.exportFailed'));
    }
  };

  if (isSettingsOpen) {
    return (
      <SettingsDialog 
        onClose={() => {
          setIsSettingsOpen(false);
          if (settingsSource === 'hud') {
            onResume();
          }
        }} 
      />
    );
  }

  return (
    <Dialog 
      title={t('pauseMenu.title')} 
      onClose={onResume} 
      width={400}
    >
      <div className={styles.content}>
        {/* Buttons List */}
        <div className={styles.buttonList}>
          <Button variant="primary" onClick={onResume}>
            {t('pauseMenu.resume')}
          </Button>

          <Button variant="secondary" onClick={() => setIsSettingsOpen(true, 'menu')}>
            {t('settings.title')}
          </Button>
          
          <Button variant="secondary" onClick={handleSave}>
            {t(`pauseMenu.${saveStatusKey}`)}
          </Button>

          <Button variant="secondary" onClick={handleExport}>
            {t('settings.exportSave')}
          </Button>

          <Button variant="danger" onClick={onQuit}>
            {t('pauseMenu.quit')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

