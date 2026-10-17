import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlow, insertNode } from '../src/lib/flow.ts';
import { layoutFlow } from '../src/lib/layout.ts';

test('Yes stays below; No decisions use separate columns without overlaps', () => {
  let flow = createFlow();
  flow = insertNode(flow, flow.start, 'next', 'decision', 'A?');
  const a = flow.nodes[flow.start].next!;
  flow = insertNode(flow, a, 'next', 'decision', 'Nested?');
  flow = insertNode(flow, a, 'no', 'decision', 'B?');
  const result = layoutFlow(flow);
  const root = result.cards.find(n => n.id === a)!;
  const yes = result.cards.find(n => n.id === flow.nodes[a].next)!;
  const no = result.cards.find(n => n.id === flow.nodes[a].no)!;
  assert.equal(root.x, yes.x);
  assert.ok(yes.y > root.y);
  assert.ok(no.x > yes.x);
  assert.equal(no.y, root.y);
  assert.equal(new Set(result.cards.map(n => `${n.x}:${n.y}`)).size, result.cards.length);
});
