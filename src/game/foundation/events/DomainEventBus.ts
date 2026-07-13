type EventHandler = (event: unknown) => void;

interface QueuedEvent<TEventMap> {
  readonly type: keyof TEventMap;
  readonly payload: TEventMap[keyof TEventMap];
}

export type Unsubscribe = () => void;

export class BufferedDomainEventBus<TEventMap> {
  private readonly handlers = new Map<keyof TEventMap, Set<EventHandler>>();
  private pendingEvents: QueuedEvent<TEventMap>[] = [];

  public subscribe<TKey extends keyof TEventMap>(
    type: TKey,
    handler: (event: TEventMap[TKey]) => void,
  ): Unsubscribe {
    let handlersForType = this.handlers.get(type);
    if (!handlersForType) {
      handlersForType = new Set<EventHandler>();
      this.handlers.set(type, handlersForType);
    }

    const eventHandler = handler as EventHandler;
    handlersForType.add(eventHandler);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      handlersForType.delete(eventHandler);
      if (handlersForType.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  public publish<TKey extends keyof TEventMap>(type: TKey, payload: TEventMap[TKey]): void {
    this.pendingEvents.push({ type, payload });
  }

  public flush(): void {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    const errors: unknown[] = [];

    for (const event of events) {
      const handlersForType = this.handlers.get(event.type);
      if (!handlersForType) continue;

      for (const handler of Array.from(handlersForType)) {
        try {
          handler(event.payload);
        } catch (error) {
          errors.push(error);
        }
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'One or more domain event handlers failed');
    }
  }

  public clear(): void {
    this.pendingEvents = [];
    this.handlers.clear();
  }
}
