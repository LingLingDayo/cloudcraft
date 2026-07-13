export interface RuntimeSystem {
  readonly id: string;
  readonly dependencies?: readonly string[];
  initialize(): void | Promise<void>;
  fixedUpdate?(deltaSeconds: number): void;
  postUpdate?(deltaSeconds: number): void;
  dispose(): void | Promise<void>;
}

export class RuntimeKernel {
  private readonly systems = new Map<string, RuntimeSystem>();
  private initializedSystems: RuntimeSystem[] = [];
  private orderedSystems: RuntimeSystem[] = [];

  public register(system: RuntimeSystem): void {
    if (this.systems.has(system.id)) {
      throw new Error(`Duplicate runtime system: ${system.id}`);
    }
    this.systems.set(system.id, system);
  }

  public async initialize(): Promise<void> {
    this.orderedSystems = this.resolveOrder();
    this.initializedSystems = [];

    try {
      for (const system of this.orderedSystems) {
        await system.initialize();
        this.initializedSystems.push(system);
      }
    } catch (error) {
      await this.disposeInitializedSystems();
      throw error;
    }
  }

  public fixedUpdate(deltaSeconds: number): void {
    for (const system of this.orderedSystems) {
      system.fixedUpdate?.(deltaSeconds);
    }
  }

  public postUpdate(deltaSeconds: number): void {
    for (const system of this.orderedSystems) {
      system.postUpdate?.(deltaSeconds);
    }
  }

  public async dispose(): Promise<void> {
    await this.disposeInitializedSystems();
    this.orderedSystems = [];
  }

  private resolveOrder(): RuntimeSystem[] {
    const ordered: RuntimeSystem[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Runtime system dependency cycle detected at: ${id}`);
      }

      const system = this.systems.get(id);
      if (!system) {
        throw new Error(`Unknown runtime system dependency: ${id}`);
      }

      visiting.add(id);
      for (const dependency of system.dependencies ?? []) {
        visit(dependency);
      }
      visiting.delete(id);
      visited.add(id);
      ordered.push(system);
    };

    for (const id of this.systems.keys()) {
      visit(id);
    }

    return ordered;
  }

  private async disposeInitializedSystems(): Promise<void> {
    const errors: unknown[] = [];
    for (let index = this.initializedSystems.length - 1; index >= 0; index--) {
      try {
        await this.initializedSystems[index].dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    this.initializedSystems = [];

    if (errors.length > 0) {
      throw new AggregateError(errors, 'One or more runtime systems failed to dispose');
    }
  }
}
