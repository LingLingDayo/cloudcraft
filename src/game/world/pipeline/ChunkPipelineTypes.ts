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

/**
 * 抽象出来的世界地形环境数据提供者接口，解耦流水线阶段对 Generator 的直接强绑定
 */
export interface WorldTerrainProvider {
  getColumnTerrainData(wx: number, wz: number): ColumnTerrainData;
  getGroundBlockType(
    biome: Biome,
    y: number,
    waterLevel: number,
    isDryLand: boolean,
    wx: number,
    wz: number,
    slope: number
  ): number;
  getPrimaryBiome(wx: number, wz: number): Biome;
  isWaterArea(wx: number, wz: number): boolean;
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
  generator: WorldTerrainProvider;
}

export interface ChunkPipelineStage {
  name: string;
  execute(context: ChunkPipelineContext): void;
}
