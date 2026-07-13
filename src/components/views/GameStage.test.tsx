import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useGame } from '@context/GameContext';
import { GameStage } from './GameStage';

const gameManagerMocks = vi.hoisted(() => {
  const instance = {
    player: { selectedItemType: null, isFlying: false },
    controls: { isMobile: false, domElement: { requestPointerLock: vi.fn() } },
    setRenderDistance: vi.fn(),
    setFov: vi.fn(),
    captureSaveData: vi.fn(),
    restoreSaveData: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    instance,
    construct: vi.fn(function MockGameManager() {
      return instance;
    }),
  };
});

vi.mock('@game/core/GameManager', () => ({
  GameManager: gameManagerMocks.construct,
}));

vi.mock('./HUD', () => ({
  HUD: () => <div>{useGame() ? 'game-context-ready' : 'game-context-missing'}</div>,
}));

vi.mock('./PauseMenu', () => ({ PauseMenu: () => null }));

vi.mock('@i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('GameStage', () => {
  afterEach(() => {
    gameManagerMocks.construct.mockClear();
    gameManagerMocks.instance.dispose.mockClear();
  });

  test('publishes the mounted GameManager through context and disposes it on unmount', async () => {
    const { unmount } = render(<GameStage seed="test-stage-seed" loadSave={false} />);

    await waitFor(() => {
      expect(screen.getByText('game-context-ready')).toBeInTheDocument();
    });
    expect(gameManagerMocks.construct).toHaveBeenCalledOnce();

    unmount();
    expect(gameManagerMocks.instance.dispose).toHaveBeenCalledOnce();
  });
});
