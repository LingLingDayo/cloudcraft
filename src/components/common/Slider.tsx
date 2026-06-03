import React from 'react';
import styles from './Slider.module.scss';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  labelStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  valueFormatter?: (value: number) => string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  labelStyle = {},
  containerStyle = {},
  valueFormatter,
}) => {
  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.header}>
        <label className={styles.label} style={labelStyle}>
          {label}
        </label>
        <span className={styles.value} style={labelStyle}>
          {valueFormatter ? valueFormatter(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
    </div>
  );
};

