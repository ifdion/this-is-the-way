import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlow, insertNode } from '../src/lib/flow.ts';
import { createHistory, commit, undo, redo } from '../src/lib/history.ts';

test('undo and redo restore edits; a new edit clears redo', () => {
  const flow = createFlow();
  let history = createHistory(flow);
  history = commit(history, insertNode(flow, flow.start, 'next', 'step', 'First'));
  assert.equal(Object.keys(undo(history).present.nodes).length, 1);
  assert.equal(Object.keys(redo(undo(history)).present.nodes).length, 2);
  history = commit(undo(history), insertNode(flow, flow.start, 'next', 'decision', 'Instead?'));
  assert.equal(history.future.length, 0);
  assert.equal(history.present.nodes[history.present.nodes[flow.start].next!].kind, 'decision');
});
