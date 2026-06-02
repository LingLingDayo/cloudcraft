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

export interface HUDProps {
  // Managed by Zustand store
}

export interface StartMenuProps {
  onStartGame: (seed: string, renderDistance: number, fov: number, loadSave: boolean) => void;
}

export interface PauseMenuProps {
  onResume: () => void;
  onSave: () => void;
  onQuit: () => void;
}
