import type { Flow, Port } from './flow.ts';

export const CARD_WIDTH = 224;
export const CARD_HEIGHT = 80;
const COLUMN_PITCH = 288;
const ROW_PITCH = 132;
export interface CardPosition { id: string; x: number; y: number; path: string; parent?: string; port?: Port; placeholder?: boolean }
export interface Connection { from: string; to: string; port: Port; label: string }

/**
 * Orthogonal reference path with rounded corners: it leaves the right edge of
 * the alias, loops out to the right, and enters the right edge of the target.
 * The corners sweep 60px where the vertical separation allows it.
 */
export function aliasElbow(from: Pick<CardPosition, 'x' | 'y'>, to: Pick<CardPosition, 'x' | 'y'>, width = CARD_WIDTH, height = CARD_HEIGHT): string {
  const startX = from.x + width;
  const startY = from.y + height / 2;
  const endX = to.x + width;
  const endY = to.y + height / 2;
  const drop = endY - startY;
  const below = drop >= 0;
  /** shrink the sweep only when the rows are too close to fit both corners */
  const sweep = Math.min(60, Math.abs(drop) / 2);
  const elbowX = Math.max(startX, endX) + sweep + 8;
  return [
    `M${startX},${startY}`,
    `L${elbowX - sweep},${startY}`,
    `Q${elbowX},${startY} ${elbowX},${startY + (below ? sweep : -sweep)}`,
    `L${elbowX},${endY + (below ? -sweep : sweep)}`,
    `Q${elbowX},${endY} ${endX + sweep},${endY}`,
    `L${endX},${endY}`,
  ].join(' ');
}

/** Lay out the ownership tree only. Alias references never recurse. */
export function layoutFlow(flow: Flow) {
  const cards: CardPosition[] = [];
  const connections: Connection[] = [];
  let bottom = 0;
  function visit(id: string | null, col: number, row: number, path: string, parent?: string, port?: Port): number {
    const cardId = id || `${parent}:${port}`;
    cards.push({ id: cardId, x: 48 + col * COLUMN_PITCH, y: 48 + row * ROW_PITCH, path, parent, port, placeholder: !id });
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
  return { cards, connections, width: 48 + right * COLUMN_PITCH + CARD_WIDTH + 64, height: 48 + bottom * ROW_PITCH + CARD_HEIGHT + 64 };
}
