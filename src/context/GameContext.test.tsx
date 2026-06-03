import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider, useGame } from './GameContext';
import { GameManager } from '../game/core/GameManager';

const TestComponent = () => {
  const game = useGame();
  return <div data-testid="status">{game ? 'connected' : 'disconnected'}</div>;
};

describe('GameContext', () => {
  it('should return null when used outside of GameProvider', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
  });

  it('should return GameManager instance when used inside GameProvider', () => {
    const mockGame = { mock: true } as unknown as GameManager;
    render(
      <GameProvider value={mockGame}>
        <TestComponent />
      </GameProvider>
    );
    expect(screen.getByTestId('status').textContent).toBe('connected');
  });
});
