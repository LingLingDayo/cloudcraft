import React from 'react';
import styles from './Dialog.module.scss';

interface DialogProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ title, onClose, children }) => {
  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialogWindow}>
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
