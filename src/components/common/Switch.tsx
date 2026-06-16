import React from 'react';
import { sound } from '@game/systems/Sound';
import styles from './Switch.module.scss';

// 模块级常量，避免每次 render 创建新对象引用打破子组件 memo
const DEFAULT_STYLE: React.CSSProperties = {};

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
  labelStyle = DEFAULT_STYLE,
  containerStyle = DEFAULT_STYLE,
}) => {
  const handleToggle = () => {
    if (disabled) return;
    sound.playClick();
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      sound.playClick();
      onChange(!checked);
    }
  };

  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={`${styles.container} ${disabled ? styles.disabled : ''}`}
      style={containerStyle}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
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
