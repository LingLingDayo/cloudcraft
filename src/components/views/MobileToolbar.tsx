import React, { useState } from 'react';
import { useGameStore } from '@store/useGameStore';
import { useTranslation } from '@i18n';
import { useGame } from '@context/GameContext';
import { SaveManager } from '@game/systems/SaveManager';
import { GameState } from '@type';
import { isMobileDevice } from '@utils/device';
import { PixelGearIcon, PixelSaveIcon, PixelQuitIcon, PixelHamburgerIcon } from '@components/common/PixelIcons';
import { ConfirmationDialog } from '@components/common/ConfirmationDialog';
import styles from './MobileControls.module.scss';

export const MobileToolbar: React.FC = () => {
  const { t } = useTranslation();
  const gameInstance = useGame();
  const setGameState = useGameStore((state) => state.setGameState);
  const setIsSettingsOpen = useGameStore((state) => state.setIsSettingsOpen);

  const [isMobile] = useState(() => isMobileDevice());
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [isConfirmQuitOpen, setIsConfirmQuitOpen] = useState(false);

  const handleSave = async () => {
    if (gameInstance) {
      const saveData = {
        world: gameInstance.world.saveWorld(),
        player: {
          x: gameInstance.player.position.x,
          y: gameInstance.player.position.y,
          z: gameInstance.player.position.z,
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

  const handleQuit = async () => {
    await handleSave();
    setGameState(GameState.MENU);
  };

  return (
    <>
      <div className={`${styles.mobileToolbarContainer} ${toolbarExpanded ? styles.expanded : ''}`}>
        <button 
          className={`${styles.toolbarToggleBtn} glass-panel`}
          onTouchStart={(e) => {
            e.stopPropagation();
            setToolbarExpanded(!toolbarExpanded);
          }}
          onClick={() => {
            if (!isMobile) setToolbarExpanded(!toolbarExpanded);
          }}
          title={toolbarExpanded ? "Close Menu" : "Open Menu"}
        >
          <PixelHamburgerIcon />
        </button>
        
        <div className={styles.toolbarMenu}>
          <button 
            className={`${styles.toolbarBtn} glass-panel`} 
            onTouchStart={(e) => {
              e.stopPropagation();
              setIsSettingsOpen(false);
              setGameState(GameState.PAUSED);
              setToolbarExpanded(false);
            }}
            onClick={() => {
              if (!isMobile) {
                setIsSettingsOpen(false);
                setGameState(GameState.PAUSED);
                setToolbarExpanded(false);
              }
            }}
            title={t('settings.title')}
          >
            <PixelGearIcon />
          </button>

          <button 
            className={`${styles.toolbarBtn} glass-panel`} 
            onTouchStart={(e) => {
              e.stopPropagation();
              handleSave();
              setToolbarExpanded(false);
            }}
            onClick={() => {
              if (!isMobile) {
                handleSave();
                setToolbarExpanded(false);
              }
            }}
            title={t('pauseMenu.save')}
          >
            <PixelSaveIcon />
          </button>
          
          <button 
            className={`${styles.toolbarBtn} ${styles.danger} glass-panel`} 
            onTouchStart={(e) => {
              e.stopPropagation();
              setIsConfirmQuitOpen(true);
              setToolbarExpanded(false);
            }}
            onClick={() => {
              if (!isMobile) {
                setIsConfirmQuitOpen(true);
                setToolbarExpanded(false);
              }
            }}
            title={t('pauseMenu.quit')}
          >
            <PixelQuitIcon />
          </button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isConfirmQuitOpen}
        title={t('common.confirmQuitTitle')}
        message={t('common.confirmQuitMessage')}
        onConfirm={async () => {
          setIsConfirmQuitOpen(false);
          await handleQuit();
        }}
        onCancel={() => {
          setIsConfirmQuitOpen(false);
        }}
      />
    </>
  );
};
