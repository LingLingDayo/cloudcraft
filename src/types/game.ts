export const GameState = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

export const GameMode = {
  ADVENTURE: 'adventure',
  CREATIVE: 'creative',
} as const;
export type GameMode = typeof GameMode[keyof typeof GameMode];

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Size3D {
  width: number;
  height: number;
  depth: number;
}
