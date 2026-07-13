import { describe, expect, test } from 'vitest';
import { DefinitionRegistry } from './registry/DefinitionRegistry';
import { RuntimeKernel, type RuntimeSystem } from './lifecycle/RuntimeKernel';
import { BufferedDomainEventBus } from './events/DomainEventBus';
import {
  assertSnapshotCompatibility,
  createSnapshotEnvelope,
} from './serialization/Snapshot';

interface TestDefinition {
  readonly id: string;
  readonly value: number;
}

describe('DefinitionRegistry', () => {
  test('rejects duplicate definitions and writes after freeze', () => {
    const registry = new DefinitionRegistry<TestDefinition>('test');
    registry.register({ id: 'cloudcraft:first', value: 1 });

    expect(() => registry.register({ id: 'cloudcraft:first', value: 2 }))
      .toThrowError('Duplicate test definition: cloudcraft:first');

    registry.freeze();

    expect(() => registry.register({ id: 'cloudcraft:second', value: 2 }))
      .toThrowError('test registry is frozen');
  });
});

describe('RuntimeKernel', () => {
  test('initializes systems in dependency order and disposes in reverse order', async () => {
    const events: string[] = [];
    const createSystem = (id: string, dependencies: readonly string[] = []): RuntimeSystem => ({
      id,
      dependencies,
      initialize: () => {
        events.push(`init:${id}`);
      },
      dispose: () => {
        events.push(`dispose:${id}`);
      },
    });

    const kernel = new RuntimeKernel();
    kernel.register(createSystem('render', ['world']));
    kernel.register(createSystem('world', ['content']));
    kernel.register(createSystem('content'));

    await kernel.initialize();
    await kernel.dispose();

    expect(events).toEqual([
      'init:content',
      'init:world',
      'init:render',
      'dispose:render',
      'dispose:world',
      'dispose:content',
    ]);
  });
});

describe('BufferedDomainEventBus', () => {
  test('dispatches events only when flushed and supports symmetric unsubscribe', () => {
    interface Events {
      changed: { readonly revision: number };
    }

    const revisions: number[] = [];
    const bus = new BufferedDomainEventBus<Events>();
    const unsubscribe = bus.subscribe('changed', event => revisions.push(event.revision));

    bus.publish('changed', { revision: 1 });
    expect(revisions).toEqual([]);

    bus.flush();
    expect(revisions).toEqual([1]);

    unsubscribe();
    bus.publish('changed', { revision: 2 });
    bus.flush();
    expect(revisions).toEqual([1]);
  });
});

describe('SnapshotEnvelope', () => {
  test('rejects snapshots from another context or a future schema version', () => {
    const snapshot = createSnapshotEnvelope({
      contextId: 'cloudcraft:entities',
      schemaVersion: 2,
      codecId: 'cloudcraft:json',
      revision: 7,
      payload: { entities: [] },
    });

    expect(() => assertSnapshotCompatibility(snapshot, 'cloudcraft:entities', 2))
      .not.toThrow();
    expect(() => assertSnapshotCompatibility(snapshot, 'cloudcraft:fixtures', 2))
      .toThrowError('Snapshot context mismatch');
    expect(() => assertSnapshotCompatibility(snapshot, 'cloudcraft:entities', 1))
      .toThrowError('Unsupported cloudcraft:entities snapshot schema version: 2');
  });
});
