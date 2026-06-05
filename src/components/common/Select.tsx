import React, { useState, useRef, useEffect } from 'react';
import { sound } from '@game/systems/Sound';
import type { SelectOption } from '@type';
import { useTranslation } from '@i18n';
import styles from './Select.module.scss';

interface SelectProps {
  label?: string;
  value: string | number;
  options: SelectOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
  labelStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  labelStyle = {},
  containerStyle = {},
  placeholder,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    sound.playClick();
    setIsOpen(!isOpen);
  };

  const handleSelect = (optionValue: string | number) => {
    sound.playClick();
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} style={containerStyle} ref={containerRef}>
      {label && (
        <span className={styles.label} style={labelStyle}>
          {label}
        </span>
      )}
      <div className={styles.selectWrapper}>
        <button
          type="button"
          className={`${styles.trigger} ${disabled ? styles.disabled : ''}`}
          onClick={handleToggle}
          disabled={disabled}
        >
          <span className={styles.selectedText}>
            {selectedOption ? selectedOption.label : (placeholder || t('common.selectPlaceholder'))}
          </span>
          <span className={styles.arrow}>{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className={styles.dropdown}>
            {options.map((option) => (
              <div
                key={option.value}
                className={`${styles.option} ${
                  option.value === value ? styles.selectedOption : ''
                }`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
