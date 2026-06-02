import React from 'react';
import { sound } from '@game/systems/Sound';
import styles from './Switch.module.scss';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  labelStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  labelStyle = {},
  containerStyle = {},
}) => {
  const handleToggle = () => {
    if (disabled) return;
    sound.playClick();
    onChange(!checked);
  };

  return (
    <div
      className={`${styles.container} ${disabled ? styles.disabled : ''}`}
      style={containerStyle}
      onClick={handleToggle}
    >
      <span className={styles.label} style={labelStyle}>
        {label}
      </span>
      <div className={`${styles.switch} ${checked ? styles.checked : ''}`}>
        <div className={styles.thumb} />
      </div>
    </div>
  );
};
