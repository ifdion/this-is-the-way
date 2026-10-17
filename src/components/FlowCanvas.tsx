import { useEffect, useMemo, useRef, useState } from 'react';
import type { Flow, Port } from '../lib/flow.ts';
import { CARD_HEIGHT, CARD_WIDTH, layoutFlow } from '../lib/layout.ts';

interface Props {
  flow: Flow;
  selected: string;
  simulation: boolean;
  current?: string;
  onSelect: (id: string) => void;
  onAdd: (parent: string, port: Port, kind: 'step' | 'decision') => void;
}

export default function FlowCanvas({ flow, selected, simulation, current, onSelect, onAdd }: Props) {
  const layout = useMemo(() => layoutFlow(flow), [flow]);
  const scroll = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const cards = new Map(layout.cards.map(card => [card.id, card]));

  useEffect(() => {
    const element = scroll.current!;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight, left: element.scrollLeft, top: element.scrollTop });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => { observer.disconnect(); element.removeEventListener('scroll', measure); };
  }, [layout.width, layout.height]);

  useEffect(() => {
    const position = layout.cards.find(card => card.id === current);
    if (position && simulation) scroll.current?.scrollTo({ left: position.x - 100, top: position.y - 100, behavior: 'smooth' });
  }, [current, simulation, layout]);

  const overflow = viewport.width > 0 && (layout.width > viewport.width || layout.height > viewport.height);
  const mapWidth = 200;
  const mapHeight = Math.max(65, Math.min(140, mapWidth * layout.height / layout.width));

  return <section className="canvas-shell" aria-label="Flow diagram">
    <div className="canvas-caption"><span className="status-dot" /> AUTO LAYOUT <span>Yes ↓ · No →</span></div>
    <div className="canvas-scroll" ref={scroll} tabIndex={0} aria-label="Scrollable flow canvas">
      <div className="canvas-world" style={{ width: layout.width, height: layout.height, minWidth: '100%', minHeight: '100%' }}>
        <svg className="connections" width={layout.width} height={layout.height} aria-hidden="true">
          <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" strokeWidth="1.2" /></marker></defs>
          {layout.connections.map(edge => {
            const from = cards.get(edge.from)!;
            const to = cards.get(edge.to)!;
            const down = edge.port === 'next';
            const x1 = down ? from.x + CARD_WIDTH / 2 : from.x + CARD_WIDTH;
            const y1 = down ? from.y + CARD_HEIGHT : from.y + CARD_HEIGHT / 2;
            const x2 = down ? to.x + CARD_WIDTH / 2 : to.x;
            const y2 = down ? to.y : to.y + CARD_HEIGHT / 2;
            return <g key={edge.to} className={to.placeholder ? 'empty-connection' : ''}>
              <path d={`M${x1},${y1} L${x2},${y2 - (down ? 5 : 0)}`} markerEnd="url(#arrow)" />
              {edge.label && <g transform={`translate(${down ? x1 + 12 : (x1 + x2) / 2 - 18}, ${down ? (y1 + y2) / 2 : y1 - 12})`}><text>{edge.label.length > 18 ? `${edge.label.slice(0, 16)}…` : edge.label}</text></g>}
            </g>;
          })}
        </svg>
        {layout.cards.map(position => {
          const style = { left: position.x, top: position.y, width: CARD_WIDTH, height: CARD_HEIGHT };
          if (position.placeholder) return simulation ? null : <div key={position.id} className={`path-placeholder ${selected === position.id ? 'chosen' : ''}`} style={style}>
            <span>Continue this path</span>
            <div><button onClick={() => onAdd(position.parent!, position.port!, 'step')}>＋ Step</button><button onClick={() => onAdd(position.parent!, position.port!, 'decision')}>◇ Branch</button></div>
            <button className="text-button" onClick={() => onSelect(position.id)}>↩ Loop to…</button>
          </div>;
          const node = flow.nodes[position.id];
          const target = node.target ? flow.nodes[node.target] : null;
          const title = node.kind === 'alias' ? target?.title : node.title;
          return <button key={node.id} data-testid="flow-node" data-node-kind={node.kind} aria-label={`${node.kind}: ${title}`} aria-pressed={!simulation && selected === node.id} onClick={() => !simulation && onSelect(node.id)} className={`flow-card ${node.kind} ${!simulation && selected === node.id ? 'selected' : ''} ${simulation && current === node.id ? 'current' : ''}`} style={style}>
            {node.kind === 'decision' && <svg className="diamond-outline" viewBox="0 0 224 112" preserveAspectRatio="none" aria-hidden="true"><polygon points="112,2 222,56 112,110 2,56" /></svg>}
            <span className="card-kind">{node.kind === 'alias' ? '↩ LOOP TO' : node.kind === 'start' ? '● ENTRY POINT' : node.kind === 'decision' ? 'DECISION' : 'STEP'}</span>
            <strong>{title}</strong>
            {node.kind === 'step' && node.description && <span className="card-description">{node.description}</span>}
            {node.kind === 'alias' && <span className="card-description">Reference · not a copy</span>}
          </button>;
        })}
      </div>
    </div>
    {overflow && <div className="minimap-panel" data-testid="minimap">
      <div className="minimap-title">OVERVIEW <span>Click to navigate</span></div>
      <button className="minimap" aria-label="Navigate minimap" style={{ width: mapWidth, height: mapHeight }} onClick={event => {
        const box = event.currentTarget.getBoundingClientRect();
        scroll.current?.scrollTo({ left: (event.clientX - box.left) / box.width * layout.width - viewport.width / 2, top: (event.clientY - box.top) / box.height * layout.height - viewport.height / 2, behavior: 'smooth' });
      }} onKeyDown={event => {
        const directions: Record<string, [number, number]> = { ArrowDown: [0, 160], ArrowUp: [0, -160], ArrowRight: [200, 0], ArrowLeft: [-200, 0] };
        if (directions[event.key]) { event.preventDefault(); const [left, top] = directions[event.key]; scroll.current?.scrollBy({ left, top, behavior: 'smooth' }); }
      }}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
          {layout.cards.filter(card => !card.placeholder).map(card => <rect key={card.id} x={card.x} y={card.y} width={CARD_WIDTH} height={CARD_HEIGHT} rx="12" fill={flow.nodes[card.id].kind === 'decision' ? '#c7ab6c' : '#759486'} opacity={flow.nodes[card.id].kind === 'alias' ? '.4' : '1'} />)}
          <rect x={viewport.left} y={viewport.top} width={Math.min(viewport.width, layout.width)} height={Math.min(viewport.height, layout.height)} fill="#2e69531c" stroke="#28634c" strokeWidth="8" />
        </svg>
      </button>
    </div>}
    <span className="canvas-hint">{simulation ? 'Follow the highlighted step' : 'Select a card to edit · Scroll to explore'}</span>
  </section>;
}
