/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { sound } from '@game/systems/Sound';
import { Button } from '../Button';
import type {
  ControlRendererProps,
  SelectOption,
} from './types';
import styles from './SettingsModal.module.scss';

// ==================== 装饰类/排版辅助组件 ====================

export const ControlLabel: React.FC<{
  label?: string | null;
  tooltip?: string;
  disabled?: boolean;
}> = ({ label, tooltip, disabled }) => {
  if (label === undefined || label === null) return null;

  return (
    <div className={styles.controlLabelRow}>
      <label className={`${styles.controlLabel} ${disabled ? styles.disabledLabel : ''}`}>
        {label}
      </label>
      {tooltip && (
        <span className={styles.tooltipContainer} title={tooltip}>
          ?
          <span className={styles.tooltipText}>{tooltip}</span>
        </span>
      )}
    </div>
  );
};

export const ControlDescription: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;
  return <p className={styles.controlDescription}>{text}</p>;
};

export const ControlError: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;
  return <p className={styles.controlError}>{text}</p>;
};

// ==================== 基本输入控件 ====================

// 1. 文本框 (text)
export const TextInput: React.FC<ControlRendererProps> = ({
  control,
  value,
  disabled,
  onUpdate,
}) => {
  const ctrl = control as any;
  return (
    <input
      type="text"
      className={styles.pixelInput}
      value={value ?? ''}
      placeholder={ctrl.placeholder || ''}
      disabled={disabled}
      onChange={(e) => onUpdate(e.target.value)}
    />
  );
};

// 2. 文本域 (textarea)
export const TextareaControl: React.FC<ControlRendererProps> = ({
  control,
  value,
  disabled,
  onUpdate,
}) => {
  const ctrl = control as any;
  return (
    <textarea
      className={styles.pixelTextarea}
      value={value ?? ''}
      placeholder={ctrl.placeholder || ''}
      disabled={disabled}
      rows={ctrl.rows || 3}
      style={ctrl.style}
      onChange={(e) => onUpdate(e.target.value)}
    />
  );
};

// 3. 开关 (boolean)
export const SwitchControl: React.FC<ControlRendererProps> = ({
  value,
  disabled,
  control,
  onUpdate,
}) => {
  const ctrl = control as any;
  const label = ctrl.label as string | undefined;

  const handleToggle = () => {
    if (disabled) return;
    sound.playClick();
    onUpdate(!value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      sound.playClick();
      onUpdate(!value);
    }
  };

  return (
    <div
      role="switch"
      aria-checked={!!value}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={`${styles.switchContainer} ${disabled ? styles.disabled : ''}`}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
    >
      <div className={`${styles.switchTrack} ${value ? styles.checked : ''}`}>
        <div className={styles.switchThumb} />
      </div>
    </div>
  );
};

// 4. 滑块 (slider)
export const SliderControl: React.FC<ControlRendererProps> = ({
  control,
  value,
  disabled,
  onUpdate,
}) => {
  const ctrl = control as any;
  const min = ctrl.min !== undefined ? ctrl.min : 0;
  const max = ctrl.max !== undefined ? ctrl.max : 100;
  const step = ctrl.step !== undefined ? ctrl.step : 1;

  const numericValue = typeof value === 'number' ? value : min;

  return (
    <div className={styles.sliderContainer}>
      <div className={styles.sliderHeader}>
        <span className={styles.sliderValue}>
          {ctrl.valueFormatter ? ctrl.valueFormatter(numericValue) : numericValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        className={styles.pixelRange}
        value={numericValue}
        disabled={disabled}
        onChange={(e) => onUpdate(Number(e.target.value))}
      />
    </div>
  );
};

// 5. 下拉单选/多选 (select)
export const SelectControl: React.FC<ControlRendererProps> = ({
  control,
  value,
  disabled,
  onUpdate,
}) => {
  const ctrl = control as any;
  const isMultiple = !!ctrl.isMultiple;
  const options: SelectOption[] = ctrl.options || [];

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    sound.playClick();
    setIsOpen(!isOpen);
  };

  const handleOptionSelect = (optValue: string | number) => {
    sound.playClick();
    if (isMultiple) {
      const currentArray = Array.isArray(value) ? value : [];
      const index = currentArray.indexOf(optValue);
      let nextArray;
      if (index > -1) {
        nextArray = currentArray.filter((v) => v !== optValue);
      } else {
        nextArray = [...currentArray, optValue];
      }
      onUpdate(nextArray);
    } else {
      onUpdate(optValue);
      setIsOpen(false);
    }
  };

  // 生成显示的文本（用 Set 替换 filter+includes 的 O(N²) 双重遍历）
  const displayLabel = useMemo(() => {
    if (isMultiple) {
      const currentArray = Array.isArray(value) ? value : [];
      if (currentArray.length === 0) return '请选择 (多选)...';
      const currentSet = new Set(currentArray);
      const labels = options.reduce<string[]>((acc, opt) => {
        if (currentSet.has(opt.value)) acc.push(opt.label);
        return acc;
      }, []);
      return labels.join(', ');
    } else {
      const selected = options.find((opt) => opt.value === value);
      return selected ? selected.label : '请选择...';
    }
  }, [value, options, isMultiple]);

  return (
    <div className={styles.selectWrapper} ref={containerRef}>
      <button
        type="button"
        className={`${styles.selectTrigger} ${disabled ? styles.disabled : ''}`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span>{displayLabel}</span>
        <span className={styles.selectArrow}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdownList}>
          {options.map((opt) => {
            const isSelected = isMultiple
              ? Array.isArray(value) && value.includes(opt.value)
              : value === opt.value;

            return (
              <div
                key={opt.value}
                className={`${styles.dropdownOption} ${isSelected ? styles.selected : ''}`}
                onClick={() => handleOptionSelect(opt.value)}
              >
                {isMultiple && (
                  <span className={`${styles.optionCheckbox} ${isSelected ? styles.checked : ''}`}>
                    {isSelected && '✓'}
                  </span>
                )}
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// 6. 按钮 (button)
export const ButtonControl: React.FC<ControlRendererProps> = ({
  control,
  disabled,
  component,
  context,
  onRawUpdate,
}) => {
  const ctrl = control as any;
  const buttonText = ctrl.buttonText || ctrl.label || '点击触发';

  const handleClick = () => {
    if (disabled) return;
    if (ctrl.onClick) {
      const patch = ctrl.onClick(component, context);
      if (patch) {
        onRawUpdate(patch);
      }
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      disabled={disabled}
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      {buttonText}
    </Button>
  );
};

// 7. 信息文本 (ui-computed-info)
export const ComputedInfoControl: React.FC<ControlRendererProps> = ({
  value,
  control,
}) => {
  const ctrl = control as any;
  return (
    <div className={styles.computedInfo} style={ctrl.style}>
      {value ?? ''}
    </div>
  );
};

// 8. 自定义内容 (ui-custom)
export const CustomControl: React.FC<ControlRendererProps> = ({
  control,
  component,
  context,
}) => {
  const ctrl = control as any;
  if (typeof ctrl.render === 'function') {
    return <>{ctrl.render(component, context)}</>;
  }
  return null;
};
