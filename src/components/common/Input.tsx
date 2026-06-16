import React from 'react';
import styles from './Input.module.scss';

// 模块级常量，避免每次 render 创建新对象引用打破子组件 memo
const DEFAULT_STYLE: React.CSSProperties = {};

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
  labelStyle = DEFAULT_STYLE,
  containerStyle = DEFAULT_STYLE,
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
