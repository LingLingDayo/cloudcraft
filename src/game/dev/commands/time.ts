import type { GameManager } from '../../core/GameManager';

export function createTimeCommands(game: GameManager) {
  return {
    get() {
      return game.environment.getGameTime();
    },
    set(value: number) {
      if (typeof value !== 'number') {
        console.error('Time value must be a number');
        return;
      }
      const dayDuration = game.environment.getDayDuration();
      game.environment.state.gameTime = ((value % dayDuration) + dayDuration) % dayDuration;
      console.log(`Set game time to: ${game.environment.state.gameTime} seconds`);
    },
    setWeather(id: string) {
      const valid = ['clear', 'rain', 'storm'];
      if (!valid.includes(id)) {
        console.error(`Invalid weather. Valid options are: ${valid.join(', ')}`);
        return;
      }
      game.environment.setWeather(id);
      console.log(`Set weather to: ${id}`);
    },
    setDimension(id: string) {
      const valid = ['overworld', 'nether', 'cave'];
      if (!valid.includes(id)) {
        console.error(`Invalid dimension. Valid options are: ${valid.join(', ')}`);
        return;
      }
      game.environment.setDimension(id);
      console.log(`Set dimension to: ${id}`);
    }
  };
}
