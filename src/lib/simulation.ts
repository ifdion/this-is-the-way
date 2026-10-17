import type { Flow, Port } from './flow.ts';

export interface Simulation { current: string; history: string[]; ended: boolean }

export function beginSimulation(flow: Flow): Simulation {
  return { current: flow.start, history: [], ended: false };
}

export function advance(flow: Flow, run: Simulation, choice: Port = 'next'): Simulation {
  if (run.ended) return run;
  const node = flow.nodes[run.current];
  const next = node[choice];
  if (!next) return { ...run, ended: true };
  const destination = flow.nodes[next];
  return { current: destination.kind === 'alias' ? destination.target! : next, history: [...run.history, run.current], ended: false };
}

export function goBack(run: Simulation): Simulation {
  if (run.ended) return { ...run, ended: false };
  if (!run.history.length) return run;
  return { current: run.history[run.history.length - 1], history: run.history.slice(0, -1), ended: false };
}
