import { DefinitionRegistry } from '@game/foundation/registry/DefinitionRegistry';

export interface MovementMode<TContext> {
  readonly id: string;
  canActivate(context: TContext): boolean;
  update(context: TContext, deltaSeconds: number): void;
}

export class MovementModeRegistry<TContext> {
  private readonly definitions = new DefinitionRegistry<MovementMode<TContext>>('movement mode');

  public register(mode: MovementMode<TContext>): void {
    this.definitions.register(mode);
  }

  public get(id: string): MovementMode<TContext> {
    return this.definitions.get(id);
  }

  public freeze(): void {
    this.definitions.freeze();
  }
}

export class MovementModeController<TContext> {
  private readonly registry: MovementModeRegistry<TContext>;
  private configuredModeIds: readonly string[];
  private configuredModes: readonly MovementMode<TContext>[];
  private currentModeId: string | null = null;

  public constructor(
    registry: MovementModeRegistry<TContext>,
    modeIds: readonly string[],
  ) {
    this.registry = registry;
    this.configuredModeIds = [...modeIds];
    this.configuredModes = this.resolveModes(this.configuredModeIds);
  }

  public setModes(modeIds: readonly string[]): void {
    const nextModeIds = [...modeIds];
    const nextModes = this.resolveModes(nextModeIds);
    this.configuredModeIds = nextModeIds;
    this.configuredModes = nextModes;
    this.currentModeId = null;
  }

  public update(context: TContext, deltaSeconds: number): void {
    for (const mode of this.configuredModes) {
      if (!mode.canActivate(context)) continue;
      this.currentModeId = mode.id;
      mode.update(context, deltaSeconds);
      return;
    }
    this.currentModeId = null;
  }

  public get activeModeId(): string | null {
    return this.currentModeId;
  }

  public get modeIds(): readonly string[] {
    return this.configuredModeIds;
  }

  private resolveModes(modeIds: readonly string[]): readonly MovementMode<TContext>[] {
    if (modeIds.length === 0) {
      throw new Error('Creature requires at least one movement mode');
    }
    return modeIds.map(modeId => this.registry.get(modeId));
  }
}
