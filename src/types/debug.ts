export interface DebugMetrics {
  fps: number;
  chunksLoaded: number;
  isFlying: boolean;
  targetBlock: {
    type: string;
    id: number;
    x: number;
    y: number;
    z: number;
  } | null;
  playerPosition: {
    x: number;
    y: number;
    z: number;
  };
  playerDirection: string;
  playerRotation: {
    yaw: number;
    pitch: number;
  };
  chunkCoords: {
    cx: number;
    cy: number;
    cz: number;
    lx: number;
    ly: number;
    lz: number;
  };
  biome: {
    id: string;
    name: string;
    temp: number;
    moisture: number;
  } | null;
  landform: {
    id: string;
    name: string;
    continentalness: number;
    erosion: number;
  } | null;
  slope: number;
  terrainHeight: number;
  gameTime: {
    time: number;
    formatted: string;
  };
  entities: {
    droppedItems: number;
    animals: number;
  };
  renderer: {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
    gpu: string;
  };
}

