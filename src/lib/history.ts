import type { Flow } from './flow.ts';

export interface History { past: Flow[]; present: Flow; future: Flow[] }
export const createHistory = (flow: Flow): History => ({ past: [], present: flow, future: [] });
export function commit(history: History, flow: Flow): History {
  return { past: [...history.past.slice(-99), history.present], present: flow, future: [] };
}
export function undo(history: History): History {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future] };
}
export function redo(history: History): History {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
}
