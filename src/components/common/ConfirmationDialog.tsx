import React from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import styles from './ConfirmationDialog.module.scss';
import { useTranslation } from '@i18n';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'primary' | 'secondary' | 'danger';
  cancelVariant?: 'primary' | 'secondary' | 'danger';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
  cancelVariant = 'secondary',
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <Dialog 
      title={title} 
      onClose={onCancel} 
      showCloseBtn={false}
      width={360}
    >
      <div className={styles.confirmContainer}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button 
            variant={cancelVariant} 
            onClick={onCancel}
            className={styles.button}
          >
            {cancelLabel || t('common.cancel')}
          </Button>
          <Button 
            variant={confirmVariant} 
            onClick={onConfirm}
            className={styles.button}
          >
            {confirmLabel || t('common.confirm')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
