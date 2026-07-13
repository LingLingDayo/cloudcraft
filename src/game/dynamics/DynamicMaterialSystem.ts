import { FallingVoxelSimulation } from './FallingVoxelSimulation';
import type { FallingVoxelBody } from './FallingVoxelSimulation';
import type {
  DynamicMaterialRegistry,
  FallingVoxelWorldPort,
} from './DynamicMaterialRegistry';

export interface FallingVoxelViewPort {
  sync(bodies: Iterable<FallingVoxelBody>): void;
  dispose(): void;
}

export class DynamicMaterialSystem {
  private readonly simulation: FallingVoxelSimulation;
  private readonly view?: FallingVoxelViewPort;

  public constructor(
    registry: DynamicMaterialRegistry,
    world: FallingVoxelWorldPort,
    view?: FallingVoxelViewPort,
  ) {
    this.simulation = new FallingVoxelSimulation(registry, world);
    this.view = view;
  }

  public tryActivate(x: number, y: number, z: number): boolean {
    return this.simulation.tryDetach(x, y, z);
  }

  public update(deltaSeconds: number): void {
    this.simulation.update(deltaSeconds);
    this.view?.sync(this.simulation.getBodies());
  }

  public getActiveCount(): number {
    return this.simulation.getActiveCount();
  }

  public dispose(): void {
    this.simulation.clear();
    this.view?.sync(this.simulation.getBodies());
    this.view?.dispose();
  }
}
