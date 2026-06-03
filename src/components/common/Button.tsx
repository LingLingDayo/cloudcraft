import React from 'react';
import { sound } from '@game/systems/Sound';
import styles from './Button.module.scss';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  playSound?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  playSound = true,
  onClick,
  className = '',
  children,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (playSound) {
      sound.playClick();
    }
    if (onClick) {
      onClick(e);
    }
  };

  const getClassName = () => {
    const variantClass = styles[variant] || styles.primary;
    return `${variantClass} ${className}`;
  };

  return (
    <button className={getClassName()} onClick={handleClick} {...props}>
      {children}
    </button>
  );
};

