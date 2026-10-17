export type Port = 'next' | 'no';
export type NodeKind = 'start' | 'step' | 'decision' | 'alias';
export interface FlowNode {
  id: string;
  kind: NodeKind;
  title: string;
  description: string;
  next: string | null;
  no: string | null;
  target: string | null;
  yesLabel: string;
  noLabel: string;
}
export interface Flow {
  id: string;
  title: string;
  start: string;
  nodes: Record<string, FlowNode>;
  updatedAt: number;
}

function makeNode(kind: NodeKind, title: string): FlowNode {
  return { id: crypto.randomUUID(), kind, title, description: '', next: null, no: null, target: null, yesLabel: 'Yes', noLabel: 'No' };
}

export function createFlow(title = 'Untitled flow'): Flow {
  const start = makeNode('start', 'Start');
  return { id: crypto.randomUUID(), title, start: start.id, nodes: { [start.id]: start }, updatedAt: Date.now() };
}

export function insertNode(flow: Flow, parentId: string, port: Port, kind: 'step' | 'decision', title?: string): Flow {
  const copy = structuredClone(flow);
  const parent = copy.nodes[parentId];
  if (!parent || parent.kind === 'alias' || (port === 'no' && parent.kind !== 'decision')) throw new Error('Invalid connection');
  const node = makeNode(kind, title || (kind === 'decision' ? 'Condition?' : 'New step'));
  node.next = parent[port];
  parent[port] = node.id;
  copy.nodes[node.id] = node;
  copy.updatedAt = Date.now();
  return copy;
}

export function addAlias(flow: Flow, parentId: string, port: Port, targetId: string): Flow {
  const copy = structuredClone(flow);
  const parent = copy.nodes[parentId];
  const target = copy.nodes[targetId];
  if (!parent || parent.kind === 'alias' || (port === 'no' && parent.kind !== 'decision')) throw new Error('Invalid connection');
  if (parent[port]) throw new Error('Remove the existing path before adding a loop');
  if (!target || target.kind === 'alias') throw new Error('Choose an existing step or decision');
  const alias = makeNode('alias', '');
  alias.target = targetId;
  parent[port] = alias.id;
  copy.nodes[alias.id] = alias;
  copy.updatedAt = Date.now();
  return copy;
}

export type DeleteChoice = Port | 'all';

export function previewDeletion(flow: Flow, id: string, keep: DeleteChoice = 'next') {
  const node = flow.nodes[id];
  if (!node || node.kind === 'start') throw new Error('Start cannot be deleted');
  const removed = new Set([id]);
  function collect(child: string | null) {
    if (!child || removed.has(child)) return;
    removed.add(child);
    collect(flow.nodes[child].next);
    collect(flow.nodes[child].no);
  }
  if (node.kind === 'decision') {
    if (keep !== 'next') collect(node.next);
    if (keep !== 'no') collect(node.no);
  }
  const references = Object.values(flow.nodes).filter(n => n.kind === 'alias' && n.target && removed.has(n.target) && !removed.has(n.id)).map(n => n.id);
  return { removed: [...removed], references };
}

export function deleteNode(flow: Flow, id: string, keep: DeleteChoice = 'next'): Flow {
  const plan = previewDeletion(flow, id, keep);
  if (plan.references.length) throw new Error('Resolve alias references before deleting these steps');
  const copy = structuredClone(flow);
  const node = copy.nodes[id];
  const replacement = node.kind === 'decision' ? (keep === 'all' ? null : node[keep]) : node.next;
  for (const parent of Object.values(copy.nodes)) {
    for (const port of ['next', 'no'] as const) if (parent[port] === id) parent[port] = replacement;
  }
  for (const removed of plan.removed) delete copy.nodes[removed];
  copy.updatedAt = Date.now();
  return copy;
}

export function updateNode(flow: Flow, id: string, fields: Partial<Pick<FlowNode, 'title' | 'description' | 'yesLabel' | 'noLabel'>>): Flow {
  const copy = structuredClone(flow);
  Object.assign(copy.nodes[id], fields);
  copy.updatedAt = Date.now();
  return copy;
}

export function duplicateFlow(flow: Flow): Flow {
  return { ...structuredClone(flow), id: crypto.randomUUID(), title: `${flow.title} (copy)`, updatedAt: Date.now() };
}
