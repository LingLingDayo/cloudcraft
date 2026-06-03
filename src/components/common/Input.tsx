import React from 'react';
import styles from './Input.module.scss';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  labelStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  labelStyle = {},
  containerStyle = {},
  className = '',
  ...props
}) => {
  return (
    <div className={styles.container} style={containerStyle}>
      {label && (
        <label className={styles.label} style={labelStyle}>
          {label}
        </label>
      )}
      <input
        type="text"
        className={`${styles.input} ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </div>
  );
};
