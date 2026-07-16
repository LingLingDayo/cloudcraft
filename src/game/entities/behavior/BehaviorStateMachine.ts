export interface BehaviorStateDefinition<TContext> {
  readonly id: string;
  readonly parentId?: string;
  readonly onEnter?: (context: TContext) => void;
  readonly onUpdate?: (context: TContext, deltaSeconds: number) => void;
  readonly onExit?: (context: TContext) => void;
}

export interface BehaviorTransition<TContext> {
  readonly from: string;
  readonly to: string;
  readonly when: (context: TContext) => boolean;
  readonly priority?: number;
}

export class BehaviorStateMachine<TContext> {
  private readonly states = new Map<string, BehaviorStateDefinition<TContext>>();
  private readonly transitions: BehaviorTransition<TContext>[] = [];
  private readonly lineageCache = new Map<
    string,
    readonly BehaviorStateDefinition<TContext>[]
  >();
  private activeStateId: string | null = null;

  public registerState(state: BehaviorStateDefinition<TContext>): void {
    if (this.states.has(state.id)) {
      throw new Error(`Duplicate behavior state: ${state.id}`);
    }
    this.states.set(state.id, state);
    this.lineageCache.clear();
  }

  public registerTransition(transition: BehaviorTransition<TContext>): void {
    this.transitions.push(transition);
    this.transitions.sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
  }

  public hasState(stateId: string): boolean {
    return this.states.has(stateId);
  }

  public start(stateId: string, context: TContext): void {
    if (this.activeStateId) {
      throw new Error('Behavior state machine has already started');
    }
    const lineage = this.getLineage(stateId);
    for (const state of lineage) {
      state.onEnter?.(context);
    }
    this.activeStateId = stateId;
  }

  public transitionTo(stateId: string, context: TContext): void {
    if (this.activeStateId === stateId) return;
    if (!this.activeStateId) {
      this.start(stateId, context);
      return;
    }

    const fromLineage = this.getLineage(this.activeStateId);
    const toLineage = this.getLineage(stateId);
    let sharedLength = 0;
    while (
      sharedLength < fromLineage.length
      && sharedLength < toLineage.length
      && fromLineage[sharedLength].id === toLineage[sharedLength].id
    ) {
      sharedLength++;
    }

    for (let index = fromLineage.length - 1; index >= sharedLength; index--) {
      fromLineage[index].onExit?.(context);
    }
    for (let index = sharedLength; index < toLineage.length; index++) {
      toLineage[index].onEnter?.(context);
    }
    this.activeStateId = stateId;
  }

  public update(context: TContext, deltaSeconds: number): void {
    if (!this.activeStateId) return;

    // 先评估转移，使本帧 onUpdate 作用于转移后的状态（捕猎首帧即可出手）
    const preUpdateLineage = this.getLineage(this.activeStateId);
    for (const transition of this.transitions) {
      if (
        this.lineageContains(preUpdateLineage, transition.from)
        && transition.when(context)
      ) {
        this.transitionTo(transition.to, context);
        break;
      }
    }

    if (!this.activeStateId) return;
    const lineage = this.getLineage(this.activeStateId);
    for (const state of lineage) {
      state.onUpdate?.(context, deltaSeconds);
    }
  }

  public isInState(stateId: string): boolean {
    return this.activeStateId
      ? this.lineageContains(this.getLineage(this.activeStateId), stateId)
      : false;
  }

  public dispose(context: TContext): void {
    if (!this.activeStateId) return;
    const lineage = this.getLineage(this.activeStateId);
    for (let index = lineage.length - 1; index >= 0; index--) {
      lineage[index].onExit?.(context);
    }
    this.activeStateId = null;
  }

  public get currentStateId(): string | null {
    return this.activeStateId;
  }

  private getLineage(stateId: string): readonly BehaviorStateDefinition<TContext>[] {
    const cached = this.lineageCache.get(stateId);
    if (cached) return cached;

    const lineage: BehaviorStateDefinition<TContext>[] = [];
    const visited = new Set<string>();
    let current = this.states.get(stateId);
    if (!current) throw new Error(`Unknown behavior state: ${stateId}`);

    while (current) {
      if (visited.has(current.id)) {
        throw new Error(`Behavior state hierarchy contains a cycle at ${current.id}`);
      }
      visited.add(current.id);
      lineage.unshift(current);
      current = current.parentId ? this.states.get(current.parentId) : undefined;
      if (lineage[0].parentId && !current) {
        throw new Error(`Unknown parent behavior state: ${lineage[0].parentId}`);
      }
    }
    this.lineageCache.set(stateId, lineage);
    return lineage;
  }

  private lineageContains(
    lineage: readonly BehaviorStateDefinition<TContext>[],
    stateId: string,
  ): boolean {
    for (const state of lineage) {
      if (state.id === stateId) return true;
    }
    return false;
  }
}
