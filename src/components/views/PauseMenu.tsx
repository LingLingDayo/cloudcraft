import React, { useState } from 'react';
import type { PauseMenuProps } from '@type';
import { Button } from '@components/common/Button';
import { Dialog } from '@components/common/Dialog';
import { useTranslation } from '../../i18n';
import { SettingsDialog } from './SettingsDialog';
import styles from './PauseMenu.module.scss';

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onSave,
  onQuit,
}) => {
  const { t } = useTranslation();
  const [saveStatusKey, setSaveStatusKey] = useState<'save' | 'saved'>('save');
  const [showSettings, setShowSettings] = useState(false);

  const handleSave = () => {
    onSave();
    setSaveStatusKey('saved');
    setTimeout(() => {
      setSaveStatusKey('save');
    }, 1500);
  };

  if (showSettings) {
    return <SettingsDialog onClose={() => setShowSettings(false)} />;
  }

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

          <Button variant="secondary" onClick={() => setShowSettings(true)}>
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

