import { useState, useRef, useEffect } from 'react';
import { GameManager } from './game/GameManager';
import type { DebugMetrics } from './game/GameManager';
import { StartMenu } from './components/StartMenu';
import { HUD } from './components/HUD';
import { PauseMenu } from './components/PauseMenu';
import { BLOCK_TYPES } from './game/World';

type GameState = 'MENU' | 'PLAYING' | 'PAUSED';

function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  
  // Game metrics synced to React for HUD
  const [selectedBlock, setSelectedBlock] = useState<number>(BLOCK_TYPES.GRASS);
  const [life, setLife] = useState<number>(10);
  const [position, setPosition] = useState<{ x: number; y: number; z: number }>({ x: 8.5, y: 40, z: 8.5 });
  const [onGround, setOnGround] = useState<boolean>(false);
  const [inWater, setInWater] = useState<boolean>(false);

  // Debug panel
  const [debugOverlay, setDebugOverlay] = useState<boolean>(false);
  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics | null>(null);

  // Settings
  const [renderDistance, setRenderDistance] = useState<number>(3);
  const [fov, setFov] = useState<number>(75);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const activeParamsRef = useRef<{ seed: string; renderDistance: number; fov: number; loadSave: boolean } | null>(null);

  // Initialize GameManager once the canvas is mounted and state is PLAYING
  useEffect(() => {
    if (gameState === 'PLAYING' && canvasRef.current && !gameManagerRef.current) {
      const params = activeParamsRef.current;
      const seed = params?.seed || 'minicraft';
      const initialDistance = params?.renderDistance || 3;
      const initialFov = params?.fov || 75;

      // Create new GameManager
      const gm = new GameManager(
        canvasRef.current,
        (paused) => {
          setGameState(paused ? 'PAUSED' : 'PLAYING');
        },
        (debugVisible) => {
          setDebugOverlay(debugVisible);
        },
        seed
      );

      // Apply initial settings
      gm.setRenderDistance(initialDistance);
      gm.setFov(initialFov);
      gm.selectedBlockType = selectedBlock;

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
              gm.playerPosition.set(saved.player.x, saved.player.y, saved.player.z);
              gm.camera.position.copy(gm.playerPosition);
              gm.camera.position.y += 1.6;
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
      gm.selectedBlockType = selectedBlock;
    }
  }, [selectedBlock]);

  // Synchronize player coordinates and states to React at low-frequency (100ms)
  // to maximize game thread FPS performance
  useEffect(() => {
    let interval: number | null = null;
    if (gameState === 'PLAYING') {
      interval = window.setInterval(() => {
        const gm = gameManagerRef.current;
        if (gm) {
          setPosition({
            x: gm.playerPosition.x,
            y: gm.playerPosition.y,
            z: gm.playerPosition.z,
          });
          setOnGround(gm.playerState.onGround);
          setInWater(gm.playerState.inWater);
          setLife(gm.life);

          if (gm.debugOverlayVisible) {
            setDebugMetrics(gm.getDebugMetrics());
          }
        }
      }, 100);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [gameState]);

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
          x: gm.playerPosition.x,
          y: gm.playerPosition.y,
          z: gm.playerPosition.z,
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

  const handleSelectBlock = (blockType: number) => {
    setSelectedBlock(blockType);
    const gm = gameManagerRef.current;
    if (gm) {
      gm.selectedBlockType = blockType;
    }
  };

  const handleRenderDistanceChange = (dist: number) => {
    setRenderDistance(dist);
    if (activeParamsRef.current) {
      activeParamsRef.current.renderDistance = dist;
    }
    const gm = gameManagerRef.current;
    if (gm) {
      gm.setRenderDistance(dist);
    }
  };

  const handleFovChange = (newFov: number) => {
    setFov(newFov);
    if (activeParamsRef.current) {
      activeParamsRef.current.fov = newFov;
    }
    const gm = gameManagerRef.current;
    if (gm) {
      gm.setFov(newFov);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {gameState === 'MENU' && <StartMenu onStartGame={handleStartGame} />}

      {gameState !== 'MENU' && (
        <div className="game-container">
          <canvas ref={canvasRef} className="game-canvas" />

          <HUD
            selectedBlock={selectedBlock}
            onSelectBlock={handleSelectBlock}
            life={life}
            position={position}
            onGround={onGround}
            inWater={inWater}
            debugOverlay={debugOverlay}
            debugMetrics={debugMetrics}
          />
        </div>
      )}

      {gameState === 'PAUSED' && (
        <PauseMenu
          onResume={handleResume}
          onSave={handleSave}
          onQuit={handleQuit}
          renderDistance={renderDistance}
          onRenderDistanceChange={handleRenderDistanceChange}
          fov={fov}
          onFovChange={handleFovChange}
        />
      )}
    </div>
  );
}

export default App;
