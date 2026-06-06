import React from 'react';
import { useBackToClose } from '@hooks/useBackToClose';
import styles from './Dialog.module.scss';

interface DialogProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string | number;
  height?: string | number;
  closeOnBack?: boolean;
  noPadding?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({ 
  title, 
  onClose, 
  children, 
  width, 
  height,
  closeOnBack = true,
  noPadding = false
}) => {
  useBackToClose({ onClose, enabled: closeOnBack });
  const style: React.CSSProperties = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  const getWindowClassName = () => {
    return `${styles.dialogWindow} ${noPadding ? styles.noPadding : ''}`;
  };

  return (
    <div className={styles.dialogOverlay}>
      <div className={getWindowClassName()} style={style}>
        <div className={styles.dialogHeader}>
          {title ? (
            <h3 className={`pixel-text-sm ${styles.dialogTitle}`}>{title}</h3>
          ) : (
            <div />
          )}
          <button 
            type="button" 
            className={styles.closeBtn} 
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className={styles.dialogContent}>
          {children}
        </div>
      </div>
    </div>
  );
};
