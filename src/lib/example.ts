import { addAlias, createFlow, insertNode, updateNode } from './flow.ts';

export function createExample() {
  let flow = createFlow('A little launch plan');
  flow = insertNode(flow, flow.start, 'next', 'step', 'Shape the idea');
  const idea = flow.nodes[flow.start].next!;
  flow = updateNode(flow, idea, { description: 'Write down the problem and the smallest useful solution.' });
  flow = insertNode(flow, idea, 'next', 'decision', 'Ready to build?');
  const ready = flow.nodes[idea].next!;
  flow = insertNode(flow, ready, 'next', 'step', 'Build something small');
  const build = flow.nodes[ready].next!;
  flow = insertNode(flow, build, 'next', 'step', 'Put it in people’s hands');
  flow = insertNode(flow, ready, 'no', 'decision', 'Need more clarity?');
  const clarity = flow.nodes[ready].no!;
  flow = insertNode(flow, clarity, 'next', 'step', 'Talk it through');
  flow = addAlias(flow, flow.nodes[clarity].next!, 'next', idea);
  flow = insertNode(flow, clarity, 'no', 'step', 'Try a tiny prototype');
  return flow;
}
