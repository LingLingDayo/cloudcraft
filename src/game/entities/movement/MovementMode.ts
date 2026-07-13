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
  private currentModeId: string | null = null;

  public constructor(
    registry: MovementModeRegistry<TContext>,
    modeIds: readonly string[],
  ) {
    this.registry = registry;
    this.configuredModeIds = [...modeIds];
    this.validateModes();
  }

  public setModes(modeIds: readonly string[]): void {
    this.configuredModeIds = [...modeIds];
    this.validateModes();
    this.currentModeId = null;
  }

  public update(context: TContext, deltaSeconds: number): void {
    const mode = this.configuredModeIds
      .map(modeId => this.registry.get(modeId))
      .find(candidate => candidate.canActivate(context));
    if (!mode) {
      this.currentModeId = null;
      return;
    }
    this.currentModeId = mode.id;
    mode.update(context, deltaSeconds);
  }

  public get activeModeId(): string | null {
    return this.currentModeId;
  }

  public get modeIds(): readonly string[] {
    return this.configuredModeIds;
  }

  private validateModes(): void {
    if (this.configuredModeIds.length === 0) {
      throw new Error('Creature requires at least one movement mode');
    }
    for (const modeId of this.configuredModeIds) {
      this.registry.get(modeId);
    }
  }
}
