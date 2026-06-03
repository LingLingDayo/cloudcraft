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
