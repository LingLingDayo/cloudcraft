import type { WorldFeature } from './WorldFeature';
import type { BlockWriter, RandomProvider } from '../TreeStructureGenerator';
import { BLOCK_TYPES } from '../BlockConfig';

export class CactusFeature implements WorldFeature {
  public readonly id = 'cactus';

  public generate(
    writer: BlockWriter,
    x: number,
    y: number,
    z: number,
    random: RandomProvider
  ): boolean {
    const heightRand = random(x, y, z);
    const cactusHeight = 1 + Math.floor(Math.abs(heightRand) * 3); // 1 to 3

    for (let h = 1; h <= cactusHeight; h++) {
      const cy = y + h;
      if (cy < 512) { // WORLD_HEIGHT is 512
        if (writer.getBlock(x, cy, z) === BLOCK_TYPES.AIR) {
          writer.setBlock(x, cy, z, BLOCK_TYPES.CACTUS);
        }
      }
    }

    return true;
  }
}
