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
}
