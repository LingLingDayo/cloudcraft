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
    document.documentElement.className = language === 'zh' ? 'lang-zh' : 'lang-en';
  }, [language]);

  // Clean up game parameters when returning to the start menu (unmounting GameStage)
  useEffect(() => {
    if (gameState === GameState.MENU) {
      setGameParams(null);
    }
  }, [gameState]);

  // Prefetch the GameStage chunk (which contains Three.js) in the background during idle time
  useEffect(() => {
    const prefetch = () => {
      import('@components/views/GameStage').catch((err) => {
        console.warn('Background prefetch for GameStage failed:', err);
      });
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => prefetch());
    } else {
      setTimeout(prefetch, 2000); // Fallback: prefetch after 2 seconds
    }
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


