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
  selectedBlock: number;
  onSelectBlock: (blockType: number) => void;
  life: number;
  position: { x: number; y: number; z: number };
  onGround: boolean;
  inWater: boolean;
  debugOverlay?: boolean;
  debugMetrics?: DebugMetrics | null;
}

export interface StartMenuProps {
  onStartGame: (seed: string, renderDistance: number, fov: number, loadSave: boolean) => void;
}

export interface PauseMenuProps {
  onResume: () => void;
  onSave: () => void;
  onQuit: () => void;
  renderDistance: number;
  onRenderDistanceChange: (dist: number) => void;
  fov: number;
  onFovChange: (fov: number) => void;
}
