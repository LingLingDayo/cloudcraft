import React from 'react';
import { sound } from '../../game/systems/Sound';

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
    switch (variant) {
      case 'secondary':
        return `btn-secondary ${className}`;
      case 'danger':
        return `btn-danger ${className}`;
      case 'primary':
      default:
        return `btn-primary ${className}`;
    }
  };

  return (
    <button className={getClassName()} onClick={handleClick} {...props}>
      {children}
    </button>
  );
};
