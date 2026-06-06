import { ImprovedNoise } from '../Noise';
import type { Biome } from '../biome/Biome';

export interface ColumnTerrainData {
  interpolatedHeight: number;
  adjustedHeight: number;
  finalHeight: number;
  localWaterLevel: number;
  isDryLand: boolean;
  isPond: boolean;
  maxHeightOffset: number;
  slope: number;
}

export type ChunkTerrainMap = ColumnTerrainData[][];

export interface ChunkPipelineContext {
  cx: number;
  cy: number;
  cz: number;
  worldStartX: number;
  worldStartY: number;
  worldStartZ: number;
  chunk: Uint8Array;
  noise: ImprovedNoise;
  terrainMap: ChunkTerrainMap;
  biomeMap: Biome[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator: any;
}

export interface ChunkPipelineStage {
  name: string;
  execute(context: ChunkPipelineContext): void;
}
