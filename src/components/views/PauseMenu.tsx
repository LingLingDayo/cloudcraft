import React, { useState } from 'react';
import type { PauseMenuProps } from '@type';
import { Button } from '@components/common/Button';
import { Dialog } from '@components/common/Dialog';
import { useTranslation } from '@i18n';
import { SettingsDialog } from './SettingsDialog';
import { useGameStore } from '@store/useGameStore';
import styles from './PauseMenu.module.scss';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onSave,
  onQuit,
}) => {
  const { t } = useTranslation();
  const [saveStatusKey, setSaveStatusKey] = useState<'save' | 'saved'>('save');
  
  const isSettingsOpen = useGameStore((state) => state.isSettingsOpen);
  const setIsSettingsOpen = useGameStore((state) => state.setIsSettingsOpen);
  const settingsSource = useGameStore((state) => state.settingsSource);

  const handleSave = () => {
    onSave();
    setSaveStatusKey('saved');
    setTimeout(() => {
      setSaveStatusKey('save');
    }, 1500);
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
        onSave={onSave} 
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

          <Button variant="danger" onClick={onQuit}>
            {t('pauseMenu.quit')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

