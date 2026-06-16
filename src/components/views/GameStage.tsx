import { useRef, useEffect } from 'react';
import { GameManager } from '@game/core/GameManager';
import { HUD } from './HUD';
import { PauseMenu } from './PauseMenu';
import { useGameStore } from '@store/useGameStore';
import styles from './GameStage.module.scss';
import { GameState, GameMode, type ItemType } from '@type';
import { GameProvider } from '@context/GameContext';
import { SaveManager } from '@game/systems/SaveManager';
import { useTranslation } from '@i18n';

interface GameStageProps {
  seed: string;
  loadSave: boolean;
}

export const GameStage: React.FC<GameStageProps> = ({ seed, loadSave }) => {
  const { t } = useTranslation();
  const gameState = useGameStore((state) => state.gameState);
  const setGameState = useGameStore((state) => state.setGameState);
  const selectedItem = useGameStore((state) => state.selectedItem);
  const isDamaged = useGameStore((state) => state.isDamaged);
  const renderDistance = useGameStore((state) => state.renderDistance);
  const fov = useGameStore((state) => state.fov);
  const gameMode = useGameStore((state) => state.gameMode);
  const isInventoryOpen = useGameStore((state) => state.isInventoryOpen);
  const activeChest = useGameStore((state) => state.activeChest);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const selectedItemRef = useRef<ItemType | null>(selectedItem);
  // 用 ref 持有最新的初始化参数，避免在 init effect 中声明额外依赖导致 GM 被反复重置
  const renderDistanceRef = useRef(renderDistance);
  const fovRef = useRef(fov);

  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  useEffect(() => {
    renderDistanceRef.current = renderDistance;
  }, [renderDistance]);

  useEffect(() => {
    fovRef.current = fov;
  }, [fov]);

  // Initialize GameManager once the canvas is mounted
  useEffect(() => {
    let active = true;

    if (canvasRef.current && !gameManagerRef.current) {
      // Create new GameManager without UI callbacks (handled via Zustand directly)
      const gm = new GameManager(canvasRef.current, seed);

      // Apply initial settings (via refs to avoid extra effect dependencies)
      gm.setRenderDistance(renderDistanceRef.current);
      gm.setFov(fovRef.current);
      gm.player.selectedItemType = selectedItemRef.current;

      gameManagerRef.current = gm;

      // Handle loading saved world
      if (loadSave) {
        SaveManager.getSave('default_world')
          .then((saved) => {
            if (!active || gameManagerRef.current !== gm) return;
            if (saved) {
              try {
                if (saved.world) {
                  gm.world.loadWorld(saved.world);
                }
                if (saved.player) {
                  gm.player.position.set(saved.player.x, saved.player.y, saved.player.z);
                  gm.player.syncCamera();
                }
                if (saved.gameMode) {
                  useGameStore.getState().setGameMode(saved.gameMode);
                }
                if (saved.hotbar !== undefined) {
                  let loadedInventory = saved.inventory ?? Array(54).fill(null);
                  if (loadedInventory.length < 54) {
                    loadedInventory = [
                      ...loadedInventory,
                      ...Array(54 - loadedInventory.length).fill(null)
                    ];
                  }
                  useGameStore.setState({
                    hotbar: saved.hotbar,
                    inventory: loadedInventory,
                    activeSlot: saved.activeSlot ?? 0,
                    selectedItem: saved.hotbar[saved.activeSlot ?? 0]?.type ?? null
                  });
                }
                // Trigger immediate render distance load
                gm.setRenderDistance(renderDistanceRef.current);
              } catch (e) {
                console.error('Error loading save data', e);
              }
            }
          })
          .catch((err) => {
            console.error('Failed to load save:', err);
          });
      }
    }

    return () => {
      active = false;
      if (gameManagerRef.current) {
        gameManagerRef.current.dispose();
        gameManagerRef.current = null;
      }
    };
    // seed / loadSave 变化才真正需要重建引擎；renderDistance/fov 通过 ref 在首次初始化时读取
  }, [seed, loadSave]);

  // Synchronize selected item to GameManager
  useEffect(() => {
    const gm = gameManagerRef.current;
    if (gm) {
      gm.player.selectedItemType = selectedItem;
    }
  }, [selectedItem]);

  // Synchronize render distance to GameManager
  useEffect(() => {
    const gm = gameManagerRef.current;
    if (gm) {
      gm.setRenderDistance(renderDistance);
    }
  }, [renderDistance]);

  // Synchronize fov to GameManager
  useEffect(() => {
    const gm = gameManagerRef.current;
    if (gm) {
      gm.setFov(fov);
    }
  }, [fov]);



  // Synchronize game mode and disable flying if not creative
  useEffect(() => {
    const gm = gameManagerRef.current;
    if (gm) {
      if (gameMode !== GameMode.CREATIVE) {
        gm.player.isFlying = false;
      }
    }
  }, [gameMode]);

  // Resume game handler
  const handleResume = () => {
    const gm = gameManagerRef.current;
    if (gm && gm.controls) {
      if (gm.controls.isMobile) {
        setGameState(GameState.PLAYING);
      } else {
        gm.controls.domElement.requestPointerLock();
      }
    }
  };

  // Save game handler
  const handleSave = async () => {
    const gm = gameManagerRef.current;
    if (gm) {
      const saveData = {
        world: gm.world.saveWorld(),
        seed: gm.world.getSeed(),
        player: {
          x: gm.player.position.x,
          y: gm.player.position.y,
          z: gm.player.position.z,
        },
        hotbar: useGameStore.getState().hotbar,
        inventory: useGameStore.getState().inventory,
        activeSlot: useGameStore.getState().activeSlot,
        gameMode: useGameStore.getState().gameMode,
        version: SaveManager.GAME_VERSION,
      };
      try {
        await SaveManager.saveGame('default_world', saveData, t('startMenu.defaultWorldName'));
      } catch (err) {
        console.error('Failed to save game data:', err);
      }
    }
  };

  // Quit game handler
  const handleQuit = async () => {
    await handleSave();
    setGameState(GameState.MENU);
  };

  return (
    <div className="game-container">
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Red vignette damage overlay flash */}
      {isDamaged && (
        <div className={styles.damageOverlay} />
      )}

      {/* eslint-disable-next-line react-hooks/refs */}
      <GameProvider value={gameManagerRef.current}>
        <HUD />
        {gameState === GameState.PAUSED && !activeChest && !isInventoryOpen && (
          <PauseMenu
            onResume={handleResume}
            onSave={handleSave}
            onQuit={handleQuit}
          />
        )}
      </GameProvider>
    </div>
  );
};

export default GameStage;
