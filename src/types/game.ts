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
