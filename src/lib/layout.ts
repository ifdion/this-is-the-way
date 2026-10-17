import type { Flow, Port } from './flow.ts';

export const CARD_WIDTH = 224;
export const CARD_HEIGHT = 112;
export interface CardPosition { id: string; x: number; y: number; path: string; parent?: string; port?: Port; placeholder?: boolean }
export interface Connection { from: string; to: string; port: Port; label: string }

/** Lay out the ownership tree only. Alias references never recurse. */
export function layoutFlow(flow: Flow) {
  const cards: CardPosition[] = [];
  const connections: Connection[] = [];
  let bottom = 0;
  function visit(id: string | null, col: number, row: number, path: string, parent?: string, port?: Port): number {
    const cardId = id || `${parent}:${port}`;
    cards.push({ id: cardId, x: 64 + col * 340, y: 48 + row * 224, path, parent, port, placeholder: !id });
    bottom = Math.max(bottom, row);
    if (parent && port) {
      const owner = flow.nodes[parent];
      connections.push({ from: parent, to: cardId, port, label: owner.kind === 'decision' ? (port === 'next' ? owner.yesLabel : owner.noLabel) : '' });
    }
    if (!id) return col;
    const node = flow.nodes[id];
    if (node.kind === 'alias') return col;
    const down = visit(node.next, col, row + 1, `${path} / ${node.kind === 'decision' ? 'Yes' : 'Next'}`, id, 'next');
    if (node.kind === 'decision') return visit(node.no, down + 1, row, `${path} / No`, id, 'no');
    return down;
  }
  const right = visit(flow.start, 0, 0, 'Start');
  return { cards, connections, width: 64 + right * 340 + CARD_WIDTH + 96, height: 48 + bottom * 224 + CARD_HEIGHT + 80 };
}
