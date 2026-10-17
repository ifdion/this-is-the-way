import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { createFlow, duplicateFlow } from '../src/lib/flow.ts';
import { FlowRepository } from '../src/lib/storage.ts';

test('multiple flows survive reopening; edits and deletion remain isolated', async () => {
  const name = crypto.randomUUID();
  const store = new FlowRepository(indexedDB, name);
  const one = createFlow('One');
  const two = duplicateFlow(one);
  await store.save(one);
  await store.save(two);
  const reopened = new FlowRepository(indexedDB, name);
  assert.equal((await reopened.list()).length, 2);
  await reopened.save({ ...one, title: 'Updated' });
  await reopened.remove(two.id);
  assert.deepEqual((await store.list()).map(f => f.title), ['Updated']);
  store.close();
  reopened.close();
});
