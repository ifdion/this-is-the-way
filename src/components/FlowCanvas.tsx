import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Flow, Port } from "../lib/flow.ts";
import { aliasElbow, CARD_HEIGHT, CARD_WIDTH, layoutFlow } from "../lib/layout.ts";

interface Props {
  flow: Flow;
  selected: string;
  simulation: boolean;
  current?: string;
  focusRequest: { id: string } | null;
  onSelect: (id: string) => void;
  onAdd: (parent: string, port: Port, kind: "step" | "decision") => void;
  onLoop: (parent: string, port: Port) => void;
  onJump: (id: string) => void;
}

export default function FlowCanvas({
  flow,
  selected,
  simulation,
  current,
  focusRequest,
  onSelect,
  onAdd,
  onLoop,
  onJump,
}: Props) {
  const layout = useMemo(() => layoutFlow(flow), [flow]);
  const scroll = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const [hoveredAlias, setHoveredAlias] = useState<string | null>(null);
  const [focusedAlias, setFocusedAlias] = useState<string | null>(null);
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    contentWidth: layout.width,
    contentHeight: layout.height,
  });
  const cards = new Map(layout.cards.map((card) => [card.id, card]));
  const referenceId = hoveredAlias || focusedAlias;
  const reference = referenceId ? flow.nodes[referenceId] : undefined;
  const referenceFrom = reference ? cards.get(reference.id) : undefined;
  const referenceTo = reference?.target ? cards.get(reference.target) : undefined;

  useEffect(() => {
    const element = scroll.current!;
    const measure = () =>
      setViewport({
        width: element.clientWidth,
        height: element.clientHeight,
        left: element.scrollLeft,
        top: element.scrollTop,
        contentWidth: element.scrollWidth,
        contentHeight: element.scrollHeight,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(world.current!);
    element.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, [layout.width, layout.height]);

  useEffect(() => {
    const id = simulation ? current : focusRequest?.id;
    const position = layout.cards.find((card) => card.id === id);
    const element = scroll.current;
    if (position && element)
      element.scrollTo({
        left: position.x + CARD_WIDTH / 2 - element.clientWidth / 2,
        top: position.y + CARD_HEIGHT / 2 - element.clientHeight / 2,
        behavior: "smooth",
      });
    // Navigation requests, not content edits or resize events, move the camera.
  }, [current, simulation, focusRequest]);

  const overflow =
    viewport.width > 0 &&
    (viewport.contentWidth > viewport.width ||
      viewport.contentHeight > viewport.height);
  const mapScale = Math.min(
    200 / viewport.contentWidth,
    140 / viewport.contentHeight,
  );
  const mapWidth = viewport.contentWidth * mapScale;
  const mapHeight = viewport.contentHeight * mapScale;

  return (
    <section className="canvas-shell" aria-label="Flow diagram">
      <div className="canvas-caption">
        <span className="status-dot" /> AUTO LAYOUT <span>Yes ↓ · No →</span>
      </div>
      <div
        className="canvas-scroll"
        ref={scroll}
        tabIndex={0}
        aria-label="Scrollable flow canvas"
      >
        <div
          className="canvas-world"
          ref={world}
          style={{
            width: layout.width,
            height: layout.height,
            minWidth: "100%",
            minHeight: "100%",
          }}
        >
          <svg
            className="connections"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path
                  d="M0,0 L6,3 L0,6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </marker>
              <marker id="loop-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7" fill="none" stroke="#36744e" strokeWidth="1.5" />
              </marker>
            </defs>
            {layout.connections.map((edge) => {
              const from = cards.get(edge.from)!;
              const to = cards.get(edge.to)!;
              // The arrow into an unused path only appears with its placeholder card.
              if (to.placeholder && (simulation || selected !== to.parent))
                return null;
              const down = edge.port === "next";
              const x1 = down ? from.x + CARD_WIDTH / 2 : from.x + CARD_WIDTH;
              const y1 = down ? from.y + CARD_HEIGHT : from.y + CARD_HEIGHT / 2;
              const x2 = down ? to.x + CARD_WIDTH / 2 : to.x;
              const y2 = down ? to.y : to.y + CARD_HEIGHT / 2;
              return (
                <g
                  key={edge.to}
                  className={to.placeholder ? "empty-connection" : ""}
                >
                  <path
                    d={`M${x1},${y1} L${x2},${y2 - (down ? 5 : 0)}`}
                    markerEnd="url(#arrow)"
                  />
                  {edge.label && (
                    <g
                      transform={`translate(${down ? x1 + 12 : (x1 + x2) / 2 - 18}, ${down ? (y1 + y2) / 2 : y1 - 12})`}
                    >
                      <text>
                        {edge.label.length > 18
                          ? `${edge.label.slice(0, 16)}…`
                          : edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {referenceFrom && referenceTo && <path data-testid="alias-elbow" className="alias-elbow" d={aliasElbow(referenceFrom, referenceTo)} markerEnd="url(#loop-arrow)" />}
          </svg>
          {layout.cards.map((position) => {
            const style = {
              left: position.x,
              top: position.y,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
            };
            if (position.placeholder)
              return !simulation && selected === position.parent ? (
                <div
                  key={position.id}
                  className="path-placeholder chosen"
                  style={style}
                >
                  <span>Continue this path</span>
                  <div>
                    <button
                      onClick={() =>
                        onAdd(position.parent!, position.port!, "step")
                      }
                    >
                      ＋ Step
                    </button>
                    <button
                      onClick={() =>
                        onAdd(position.parent!, position.port!, "decision")
                      }
                    >
                      ◇ Branch
                    </button>
                    <button
                      onClick={() => onLoop(position.parent!, position.port!)}
                    >
                      ↩ Loop to
                    </button>
                  </div>
                </div>
              ) : null;
            const node = flow.nodes[position.id];
            const target = node.target ? flow.nodes[node.target] : null;
            const title = node.kind === "alias" ? target?.title : node.title;
            const terminal = node.kind === "step" && !node.next;
            return (
              <Fragment key={node.id}>
                <button
                  data-testid="flow-node"
                  data-node-kind={node.kind}
                  aria-label={`${node.kind}: ${title}`}
                  aria-pressed={!simulation && selected === node.id}
                  onMouseEnter={() => { if (node.kind === "alias") setHoveredAlias(node.id); }}
                  onMouseLeave={() => setHoveredAlias(null)}
                  onFocus={event => { if (node.kind === "alias" && event.currentTarget.matches(":focus-visible")) setFocusedAlias(node.id); }}
                  onBlur={() => setFocusedAlias(null)}
                  onClick={() => {
                    if (!simulation) onSelect(node.id);
                  }}
                  className={`flow-card ${node.kind} ${terminal ? "terminal" : ""} ${referenceTo?.id === node.id ? "loop-origin" : ""} ${!simulation && selected === node.id ? "selected" : ""} ${simulation && current === node.id ? "current" : ""}`}
                  style={style}
                >
                  {node.kind === "decision" && (
                    <span className="decision-icon" aria-hidden="true">
                      ◆
                    </span>
                  )}
                  {!terminal && <span className="card-kind">
                    {node.kind === "alias"
                      ? "↩ LOOP TO"
                      : node.kind === "start"
                        ? "● ENTRY POINT"
                        : node.kind === "decision"
                          ? "DECISION"
                          : "STEP"}
                  </span>}
                  <strong>{title}</strong>
                  {(node.kind === "step" || node.kind === "decision") &&
                    node.description && (
                      <span className="card-description">
                        {node.description}
                      </span>
                    )}
                  {node.kind === "alias" && (
                    <span className="card-description">
                      Reference · not a copy
                    </span>
                  )}
                </button>
                {node.kind === "alias" && !simulation && (
                  <button
                    className="alias-edit"
                    style={{
                      left: position.x + CARD_WIDTH - 30,
                      top: position.y + 5,
                    }}
                    aria-label={`Go to referred step: ${title}`}
                    title="Go to referred step"
                    onMouseEnter={() => setHoveredAlias(node.id)}
                    onMouseLeave={() => setHoveredAlias(null)}
                    onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setFocusedAlias(node.id); }}
                    onBlur={() => setFocusedAlias(null)}
                    onClick={() => { if (node.target) onJump(node.target); }}
                  >
                    ↗
                  </button>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
      {overflow && (
        <div className="minimap-panel" data-testid="minimap">
          <div className="minimap-title">
            OVERVIEW <span>Click to navigate</span>
          </div>
          <button
            className="minimap"
            aria-label="Navigate minimap"
            style={{ width: mapWidth, height: mapHeight }}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              scroll.current?.scrollTo({
                left:
                  ((event.clientX - box.left) / box.width) *
                    viewport.contentWidth -
                  viewport.width / 2,
                top:
                  ((event.clientY - box.top) / box.height) *
                    viewport.contentHeight -
                  viewport.height / 2,
                behavior: "smooth",
              });
            }}
            onKeyDown={(event) => {
              const directions: Record<string, [number, number]> = {
                ArrowDown: [0, 160],
                ArrowUp: [0, -160],
                ArrowRight: [200, 0],
                ArrowLeft: [-200, 0],
              };
              if (directions[event.key]) {
                event.preventDefault();
                const [left, top] = directions[event.key];
                scroll.current?.scrollBy({ left, top, behavior: "smooth" });
              }
            }}
          >
            <svg
              viewBox={`0 0 ${viewport.contentWidth} ${viewport.contentHeight}`}
              width="100%"
              height="100%"
              aria-hidden="true"
            >
              {layout.cards
                .filter((card) => !card.placeholder)
                .map((card) => (
                  <rect
                    key={card.id}
                    x={card.x}
                    y={card.y}
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    rx="12"
                    fill={
                      flow.nodes[card.id].kind === "decision"
                        ? "#c7ab6c"
                        : "#759486"
                    }
                    opacity={flow.nodes[card.id].kind === "alias" ? ".4" : "1"}
                  />
                ))}
              <rect
                data-testid="minimap-viewport"
                x={viewport.left}
                y={viewport.top}
                width={viewport.width}
                height={viewport.height}
                fill="#2e69531c"
                stroke="#28634c"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </button>
        </div>
      )}
      <span className="canvas-hint">
        {simulation
          ? "Follow the highlighted step"
          : "Select a card to edit · Scroll to explore"}
      </span>
    </section>
  );
}
