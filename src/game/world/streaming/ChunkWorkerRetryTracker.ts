interface WorkerRetryState {
  readonly epoch: number;
  readonly revision: number;
  readonly seed: string;
  attempts: number;
}

export class ChunkWorkerRetryTracker {
  private readonly states = new Map<string, WorkerRetryState>();
  private readonly maxAttempts: number;

  public constructor(maxAttempts: number) {
    this.maxAttempts = maxAttempts;
  }

  private matches(
    state: WorkerRetryState | undefined,
    epoch: number,
    revision: number,
    seed: string,
  ): state is WorkerRetryState {
    return state?.epoch === epoch && state.revision === revision && state.seed === seed;
  }

  public canAttempt(key: string, epoch: number, revision: number, seed: string): boolean {
    const state = this.states.get(key);
    return !this.matches(state, epoch, revision, seed) || state.attempts < this.maxAttempts;
  }

  public recordAttempt(
    key: string,
    epoch: number,
    revision: number,
    seed: string,
  ): number | null {
    let state = this.states.get(key);
    if (!this.matches(state, epoch, revision, seed)) {
      state = { epoch, revision, seed, attempts: 0 };
      this.states.set(key, state);
    }
    if (state.attempts >= this.maxAttempts) return null;
    state.attempts++;
    return state.attempts;
  }

  public clear(key: string, epoch: number, revision: number, seed: string): void {
    if (this.matches(this.states.get(key), epoch, revision, seed)) this.states.delete(key);
  }

  public clearAll(): void {
    this.states.clear();
  }
}
