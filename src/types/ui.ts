export type Language = 'zh' | 'en';

export interface SelectOption {
  label: string;
  value: string | number;
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
