import { useRef, useEffect } from 'react';
import { GameManager } from './game/core/GameManager';
import { StartMenu } from './components/views/StartMenu';
import { HUD } from './components/views/HUD';
import { PauseMenu } from './components/views/PauseMenu';
import { useGameStore } from './store/useGameStore';
import styles from './App.module.scss';

function App() {
  const gameState = useGameStore((state) => state.gameState);
  const setGameState = useGameStore((state) => state.setGameState);
  const selectedBlock = useGameStore((state) => state.selectedBlock);
  const isDamaged = useGameStore((state) => state.isDamaged);
  const renderDistance = useGameStore((state) => state.renderDistance);
  const setRenderDistance = useGameStore((state) => state.setRenderDistance);
  const fov = useGameStore((state) => state.fov);
  const setFov = useGameStore((state) => state.setFov);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const activeParamsRef = useRef<{ seed: string; renderDistance: number; fov: number; loadSave: boolean } | null>(null);
  const selectedBlockRef = useRef<number>(selectedBlock);

  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  // Initialize GameManager once the canvas is mounted and state is PLAYING
  useEffect(() => {
    if (gameState === 'PLAYING' && canvasRef.current && !gameManagerRef.current) {
      const params = activeParamsRef.current;
      const seed = params?.seed || 'minicraft';
      const initialDistance = params?.renderDistance || 3;
      const initialFov = params?.fov || 75;

      // Create new GameManager without UI callbacks (handled via Zustand directly)
      const gm = new GameManager(canvasRef.current, seed);

      // Apply initial settings
      gm.setRenderDistance(initialDistance);
      gm.setFov(initialFov);
      gm.player.selectedBlockType = selectedBlockRef.current;

      gameManagerRef.current = gm;

      // Handle loading saved world
      if (params?.loadSave) {
        const rawSave = localStorage.getItem('minicraft_save');
        if (rawSave) {
          try {
            const saved = JSON.parse(rawSave);
            if (saved.world) {
              gm.world.loadWorld(saved.world);
            }
            if (saved.player) {
              gm.player.position.set(saved.player.x, saved.player.y, saved.player.z);
              gm.player.syncCamera();
            }
            // Trigger immediate render distance load
            gm.setRenderDistance(initialDistance);
          } catch (e) {
            console.error('Error loading save data', e);
          }
        }
      }
    }

    // Clean up game instance when switching back to menu
    if (gameState === 'MENU' && gameManagerRef.current) {
      gameManagerRef.current.dispose();
      gameManagerRef.current = null;
    }
  }, [gameState]);

  // Synchronize selected block to GameManager
  useEffect(() => {
    const gm = gameManagerRef.current;
    if (gm) {
      gm.player.selectedBlockType = selectedBlock;
    }
  }, [selectedBlock]);

  // Synchronize render distance to GameManager and activeParamsRef
  useEffect(() => {
    const gm = gameManagerRef.current;
    if (gm) {
      gm.setRenderDistance(renderDistance);
    }
    if (activeParamsRef.current) {
      activeParamsRef.current.renderDistance = renderDistance;
    }
  }, [renderDistance]);

  // Synchronize fov to GameManager and activeParamsRef
  useEffect(() => {
    const gm = gameManagerRef.current;
    if (gm) {
      gm.setFov(fov);
    }
    if (activeParamsRef.current) {
      activeParamsRef.current.fov = fov;
    }
  }, [fov]);

  // Start game handler
  const handleStartGame = (
    seedVal: string,
    distVal: number,
    fovVal: number,
    loadSaveVal: boolean
  ) => {
    // Store variables to apply on canvas mount
    activeParamsRef.current = {
      seed: seedVal,
      renderDistance: distVal,
      fov: fovVal,
      loadSave: loadSaveVal,
    };
    setRenderDistance(distVal);
    setFov(fovVal);
    setGameState('PLAYING');
  };

  // Resume game handler
  const handleResume = () => {
    const gm = gameManagerRef.current;
    if (gm && gm.controls) {
      // Re-engage pointer lock which automatically toggles state via controls listener
      gm.controls.domElement.requestPointerLock();
    }
  };

  // Save game handler
  const handleSave = () => {
    const gm = gameManagerRef.current;
    if (gm) {
      const saveData = {
        world: gm.world.saveWorld(),
        player: {
          x: gm.player.position.x,
          y: gm.player.position.y,
          z: gm.player.position.z,
        },
      };
      localStorage.setItem('minicraft_save', JSON.stringify(saveData));
    }
  };

  // Quit game handler
  const handleQuit = () => {
    handleSave();
    setGameState('MENU');
  };

  return (
    <div className={styles.appContainer}>
      {gameState === 'MENU' && <StartMenu onStartGame={handleStartGame} />}

      {gameState !== 'MENU' && (
        <div className="game-container">
          <canvas ref={canvasRef} className="game-canvas" />

          {/* Red vignette damage overlay flash */}
          {isDamaged && (
            <div className={styles.damageOverlay} />
          )}

          <HUD />
        </div>
      )}

      {gameState === 'PAUSED' && (
        <PauseMenu
          onResume={handleResume}
          onSave={handleSave}
          onQuit={handleQuit}
        />
      )}
    </div>
  );
}

export default App;

