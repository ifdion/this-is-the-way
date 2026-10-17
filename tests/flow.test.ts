import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlow, insertNode, addAlias, deleteNode, previewDeletion } from '../src/lib/flow.ts';
import { beginSimulation, advance, goBack } from '../src/lib/simulation.ts';

test('adding a branch preserves the existing happy path below it', () => {
  let flow = createFlow('Checkout');
  flow = insertNode(flow, flow.start, 'next', 'step', 'Pay');
  const payment = flow.nodes[flow.start].next;
  flow = insertNode(flow, flow.start, 'next', 'decision', 'Ready?');
  const decision = flow.nodes[flow.nodes[flow.start].next!];
  assert.equal(decision.kind, 'decision');
  assert.equal(decision.next, payment);
  assert.equal(decision.no, null);
});

test('deleting a decision previews discarded cards and blocks dangling aliases', () => {
  let flow = createFlow();
  flow = insertNode(flow, flow.start, 'next', 'decision', 'Ready?');
  const question = flow.nodes[flow.start].next!;
  flow = insertNode(flow, question, 'next', 'step', 'Continue');
  flow = insertNode(flow, question, 'no', 'step', 'Retry');
  const yes = flow.nodes[question].next!;
  const no = flow.nodes[question].no!;
  flow = addAlias(flow, yes, 'next', no);
  const plan = previewDeletion(flow, question, 'next');
  assert.deepEqual(new Set(plan.removed), new Set([question, no]));
  assert.equal(plan.references.length, 1);
  assert.throws(() => deleteNode(flow, question, 'next'), /alias/i);
  flow = deleteNode(flow, flow.nodes[yes].next!);
  flow = deleteNode(flow, question, 'next');
  assert.equal(flow.nodes[flow.start].next, yes);
  assert.equal(flow.nodes[no], undefined);
  assert.throws(() => deleteNode(flow, flow.start), /Start/);
});

test('simulation chooses No, follows an alias, and Back restores the decision', () => {
  let flow = createFlow('Retry');
  flow = insertNode(flow, flow.start, 'next', 'decision', 'Ready?');
  const question = flow.nodes[flow.start].next!;
  flow = addAlias(flow, question, 'no', flow.start);
  let run = advance(flow, beginSimulation(flow));
  assert.equal(run.current, question);
  run = advance(flow, run, 'no');
  assert.equal(run.current, flow.start);
  run = goBack(run);
  assert.equal(run.current, question);
  assert.equal(beginSimulation(flow).history.length, 0);
  assert.equal(flow.nodes[question].kind, 'decision');
});
