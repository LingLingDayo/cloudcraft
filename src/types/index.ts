export type GameState = 'MENU' | 'PLAYING' | 'PAUSED';

export interface DebugMetrics {
  fps: number;
  chunksLoaded: number;
  isFlying: boolean;
  targetBlock: {
    type: string;
    x: number;
    y: number;
    z: number;
  } | null;
}

export type HUDProps = Record<string, never>;

export interface StartMenuProps {
  onStartGame: (seed: string, renderDistance: number, fov: number, loadSave: boolean) => void;
}

export interface PauseMenuProps {
  onResume: () => void;
  onSave: () => void;
  onQuit: () => void;
}
