import React, { createContext, useContext } from 'react';
import { GameManager } from '../game/core/GameManager';

const GameContext = createContext<GameManager | null>(null);

export const GameProvider: React.FC<{ value: GameManager | null; children: React.ReactNode }> = ({ value, children }) => {
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = (): GameManager | null => {
  return useContext(GameContext);
};
