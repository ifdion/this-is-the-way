import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Autosave, type FlowWriter } from '../src/lib/autosave.ts';
import { createFlow, duplicateFlow, insertNode, type Flow } from '../src/lib/flow.ts';

/** Drain queued microtasks so Autosave's promise chain has entered (and often finished) each save. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

class ManualRepository implements FlowWriter {
  calls: string[] = [];
  #failures = new Set<'save' | 'remove'>();
  #gates = new Map<string, Array<(error?: unknown) => void>>();

  fail(operation: 'save' | 'remove') {
    this.#failures.add(operation);
  }

  heal(operation: 'save' | 'remove') {
    this.#failures.delete(operation);
  }

  /** Suspend the next save/remove until the test releases it. Keyed by flow id. */
  #hold(key: string) {
    return new Promise<void>((resolve, reject) => {
      const list = this.#gates.get(key) ?? [];
      list.push(error => (error ? reject(error) : resolve()));
      this.#gates.set(key, list);
    });
  }

  release(key: string) {
    this.#gates.get(key)?.shift()?.();
  }

  async save(flow: Flow): Promise<void> {
    this.calls.push(`save:${flow.title}`);
    if (this.#failures.has('save')) throw new Error('save failed');
    await this.#hold(flow.id);
    this.calls.push(`committed:${flow.title}`);
  }

  async remove(id: string): Promise<void> {
    this.calls.push(`remove:${id}`);
    if (this.#failures.has('remove')) throw new Error('remove failed');
    await this.#hold(`remove:${id}`);
  }
}

test('staging writes through the repository and settles on saved', async () => {
  const repository = new ManualRepository();
  const autosave = new Autosave(repository);
  assert.equal(autosave.status, 'saved');
  assert.equal(autosave.dirty, false);
  const flow = createFlow('Launch');
  autosave.stage(flow);
  await settle();
  assert.equal(autosave.status, 'saving');
  assert.equal(autosave.dirty, true);
  repository.release(flow.id);
  await settle();
  assert.deepEqual(repository.calls, ['save:Launch', 'committed:Launch']);
  assert.equal(autosave.status, 'saved');
  assert.equal(autosave.dirty, false);
});

test('an older save finishing later cannot override the newest status', async () => {
  const repository = new ManualRepository();
  const autosave = new Autosave(repository);
  const first = createFlow('First');
  const second = duplicateFlow(first);
  autosave.stage(first);
  autosave.stage(second);
  await settle();
  repository.release(first.id);
  await settle();
  assert.equal(autosave.status, 'saving');
  repository.release(second.id);
  await settle();
  assert.equal(autosave.status, 'saved');
});

test('failed saves leave the change pending, and retry stages it again', async () => {
  const repository = new ManualRepository();
  const autosave = new Autosave(repository);
  repository.fail('save');
  const flow = createFlow('Flaky');
  autosave.stage(flow);
  await settle();
  assert.equal(autosave.status, 'failed');
  assert.equal(autosave.dirty, true);
  repository.heal('save');
  autosave.retry();
  await settle();
  repository.release(flow.id);
  await settle();
  assert.equal(autosave.status, 'saved');
  assert.deepEqual(repository.calls, [
    'save:Flaky',
    'save:Flaky',
    'committed:Flaky',
  ]);
});

test('withdraw chains after pending saves, blocks further stages, and clears dirty', async () => {
  const repository = new ManualRepository();
  const autosave = new Autosave(repository);
  const doomed = createFlow('Doomed');
  autosave.stage(doomed);
  await settle();
  const removal = autosave.withdraw(doomed.id);
  await settle();
  repository.release(doomed.id);
  await settle();
  repository.release(`remove:${doomed.id}`);
  assert.equal(await removal, 'deleted');
  assert.equal(autosave.dirty, false);
  const before = repository.calls.length;
  autosave.stage(doomed);
  await settle();
  assert.equal(repository.calls.length, before, 'stages for a deleting flow are skipped');
});

test('a second withdraw for the same flow throws', async () => {
  const repository = new ManualRepository();
  const autosave = new Autosave(repository);
  const flow = createFlow('Once');
  const removal = autosave.withdraw(flow.id);
  await settle();
  assert.throws(() => autosave.withdraw(flow.id), /already/i);
  repository.release(`remove:${flow.id}`);
  assert.equal(await removal, 'deleted');
});

test('a failed removal reports failed and becomes staging-eligible again', async () => {
  const repository = new ManualRepository();
  const autosave = new Autosave(repository);
  repository.fail('remove');
  const flow = createFlow('Stuck');
  const removal = autosave.withdraw(flow.id);
  await settle();
  repository.release(`remove:${flow.id}`);
  assert.equal(await removal, 'failed');
  autosave.stage(flow);
  await settle();
  assert.equal(autosave.status, 'saving');
  repository.release(flow.id);
  await settle();
  assert.equal(autosave.status, 'saved');
});

test('listeners observe every status transition', async () => {
  const repository = new ManualRepository();
  const autosave = new Autosave(repository);
  const seen: string[] = [];
  const stop = autosave.subscribe(() => seen.push(autosave.status));
  const flow = createFlow('Watched');
  autosave.stage(flow);
  await settle();
  repository.release(flow.id);
  await settle();
  stop();
  autosave.stage(duplicateFlow(flow));
  await settle();
  assert.deepEqual(seen, ['saving', 'saved']);
});

test('coalescing two copies of one flow resolves to one clean state', async () => {
  const repository = new ManualRepository();
  const autosave = new Autosave(repository);
  const original = createFlow('Coalesce');
  const extended = insertNode(original, original.start, 'next', 'step', 'Second');
  autosave.stage(original);
  autosave.stage(extended);
  await settle();
  repository.release(original.id);
  await settle();
  repository.release(extended.id);
  await settle();
  assert.equal(autosave.status, 'saved');
  assert.equal(autosave.dirty, false);
  assert.equal(repository.calls.filter(call => call.startsWith('save:')).length, 2);
});
