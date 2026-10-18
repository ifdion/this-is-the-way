import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlow, insertNode, addAlias, deleteNode, previewDeletion, convertToDecision, convertToAlias, retargetAlias } from '../src/lib/flow.ts';
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

test('converting a step retains its identity, continuation, and incoming aliases', () => {
  let flow = createFlow('Convert');
  flow = insertNode(flow, flow.start, 'next', 'step', 'Ready?');
  const step = flow.nodes[flow.start].next!;
  flow = insertNode(flow, step, 'next', 'step', 'Continue');
  const continuation = flow.nodes[step].next!;
  flow = addAlias(flow, continuation, 'next', step);
  const converted = convertToDecision(flow, step);
  assert.equal(converted.nodes[step].kind, 'decision');
  assert.equal(converted.nodes[step].title, 'Ready?');
  assert.equal(converted.nodes[step].next, continuation);
  assert.equal(converted.nodes[step].no, null);
  assert.equal(converted.nodes[converted.nodes[continuation].next!].target, step);
  assert.equal(flow.nodes[step].kind, 'step');
  assert.throws(() => convertToDecision(flow, flow.start), /step/i);
});

test('converting a terminal step turns it into a loop reference', () => {
  let flow = createFlow('Terminal');
  flow = insertNode(flow, flow.start, 'next', 'step', 'End card');
  const end = flow.nodes[flow.start].next!;
  const converted = convertToAlias(flow, end, flow.start);
  assert.equal(converted.nodes[end].kind, 'alias');
  assert.equal(converted.nodes[end].target, flow.start);
  assert.equal(converted.nodes[end].next, null);
  assert.equal(converted.nodes[flow.start].kind, 'start');
  assert.equal(flow.nodes[end].kind, 'step');
  assert.throws(() => convertToAlias(flow, end, end), /existing step or decision/i);
  assert.throws(() => convertToAlias(flow, flow.start, end), /Only a step/i);
  let chained = createFlow('Chained');
  chained = insertNode(chained, chained.start, 'next', 'step', 'Middle');
  chained = insertNode(chained, chained.nodes[chained.start].next!, 'next', 'step', 'Last');
  const middle = chained.nodes[chained.start].next!;
  assert.throws(() => convertToAlias(chained, middle, chained.start), /terminal/i);
  let linked = createFlow('Linked');
  linked = insertNode(linked, linked.start, 'next', 'decision', 'Ready?');
  const question = linked.nodes[linked.start].next!;
  linked = insertNode(linked, question, 'next', 'step', 'End');
  linked = addAlias(linked, question, 'no', linked.nodes[question].next!);
  assert.throws(() => convertToAlias(linked, linked.nodes[question].next!, flow.start), /references/i);
});

test('retargeting an alias moves only its reference', () => {
  let flow = createFlow('Retarget');
  flow = insertNode(flow, flow.start, 'next', 'step', 'First');
  const first = flow.nodes[flow.start].next!;
  flow = insertNode(flow, first, 'next', 'step', 'Second');
  const second = flow.nodes[first].next!;
  flow = addAlias(flow, second, 'next', first);
  const alias = flow.nodes[second].next!;
  const retargeted = retargetAlias(flow, alias, second);
  assert.equal(retargeted.nodes[alias].target, second);
  assert.deepEqual(retargeted.nodes[second], flow.nodes[second]);
  assert.equal(retargeted.nodes[alias].next, null);
  assert.equal(flow.nodes[alias].target, first);
  assert.throws(() => retargetAlias(flow, alias, alias), /existing step or decision/i);
  assert.throws(() => retargetAlias(retargeted, alias, second), /already/i);
  assert.throws(() => retargetAlias(flow, first, first), /reference/i);
});
