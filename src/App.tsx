import { useState, useEffect, lazy, Suspense } from 'react';
import { StartMenu } from '@components/views/StartMenu';
import { WorldLoadingScreen } from '@components/views/WorldLoadingScreen';
import { useGameStore } from '@store/useGameStore';
import styles from './App.module.scss';
import { GameState } from '@type';

// Lazy load the 3D game engine and canvas components
const GameStage = lazy(() => import('@components/views/GameStage'));

function App() {
  const gameState = useGameStore((state) => state.gameState);
  const setGameState = useGameStore((state) => state.setGameState);
  const setRenderDistance = useGameStore((state) => state.setRenderDistance);
  const setFov = useGameStore((state) => state.setFov);
  const language = useGameStore((state) => state.language);
  const isWorldLoading = useGameStore((state) => state.isWorldLoading);

  // Store game parameters to pass to GameStage
  const [gameParams, setGameParams] = useState<{ seed: string; loadSave: boolean } | null>(null);

  useEffect(() => {
    document.documentElement.className = `lang-${language}`;
    document.documentElement.lang = language;
  }, [language]);

  // Prevent zoom and pinch gesture on mobile devices, and attempt silent fullscreen
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('gesturestart', handleGestureStart, { passive: false });

    // Silent fullscreen attempt on mount (may fail silently due to lack of user gesture, which is expected)
    // Avoid triggering fullscreen in dev environments
    if (!import.meta.env.DEV) {
      interface FullscreenHTMLElement extends HTMLElement {
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      }
      const docEl = document.documentElement as FullscreenHTMLElement;
      const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
      if (requestFS) {
        try {
          const result = requestFS.call(docEl);
          if (result && typeof result.catch === 'function') {
            result.catch(() => { /* Silent catch */ });
          }
        } catch {
          /* Silent catch */
        }
      }
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('gesturestart', handleGestureStart);
    };
  }, []);

  // Clean up game parameters when returning to the start menu (unmounting GameStage)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (gameState === GameState.MENU) {
      // Defer state update to avoid cascading synchronous renders warning
      timer = setTimeout(() => {
        setGameParams(null);
      }, 0);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [gameState]);

  // Prefetch the GameStage chunk (which contains Three.js) in the background during idle time
  useEffect(() => {
    const prefetch = () => {
      import('@components/views/GameStage').catch((err) => {
        console.warn('Background prefetch for GameStage failed:', err);
      });
    };

    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => prefetch());
    } else {
      timerId = setTimeout(prefetch, 2000); // Fallback: prefetch after 2 seconds
    }

    return () => {
      if (idleId !== undefined) {
        window.cancelIdleCallback(idleId);
      }
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }, []);

  // Start game handler
  const handleStartGame = (
    seedVal: string,
    distVal: number,
    fovVal: number,
    loadSaveVal: boolean
  ) => {
    // 1. Initialize loading screen states
    const store = useGameStore.getState();
    store.setWorldLoading(true);
    store.setWorldLoadingStage('engine');
    store.setWorldLoadingProgress(0);
    store.initChunkLoading([]);

    setRenderDistance(distVal);
    setFov(fovVal);
    setGameParams({
      seed: seedVal,
      loadSave: loadSaveVal,
    });
    setGameState(GameState.PLAYING);
  };

  return (
    <div className={styles.appContainer}>
      {gameState === GameState.MENU && <StartMenu onStartGame={handleStartGame} />}

      {gameState !== GameState.MENU && gameParams && (
        <Suspense fallback={null}>
          <GameStage seed={gameParams.seed} loadSave={gameParams.loadSave} />
        </Suspense>
      )}

      {isWorldLoading && <WorldLoadingScreen />}
    </div>
  );
}

export default App;


