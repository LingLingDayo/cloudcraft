import React from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  labelStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
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
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...containerStyle }}>
      <label
        style={{
          fontSize: '12px',
          color: '#94a3b8',
          fontWeight: 'bold',
          ...labelStyle,
        }}
      >
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        style={{ accentColor: '#818cf8', cursor: 'pointer' }}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
    </div>
  );
};
