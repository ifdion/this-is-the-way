import type { Flow } from "../../lib/flow.ts";
import type { Simulation } from "../../lib/simulation.ts";

interface Props {
  flow: Flow;
  run: Simulation | null;
  canUndo: boolean;
  canRedo: boolean;
  statusLabel: string;
  statusWarning: boolean;
  onShowCollection: () => void;
  onOpenManage: () => void;
  onBuild: () => void;
  onSimulate: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export default function WorkspaceToolbar({
  flow,
  run,
  canUndo,
  canRedo,
  statusLabel,
  statusWarning,
  onShowCollection,
  onOpenManage,
  onBuild,
  onSimulate,
  onUndo,
  onRedo,
}: Props) {
  return (
    <>
      <div className="workspace-heading">
        <div>
          <div className="breadcrumb">
            <button className="text-button" onClick={onShowCollection}>
              Your flows
            </button>
            <span>/</span>
            <span>{run ? "Simulation" : "Builder"}</span>
          </div>
          <button
            className="flow-title-button"
            onClick={() => !run && onOpenManage()}
          >
            <h1>{flow.title}</h1>
            {!run && <span>✎</span>}
          </button>
        </div>
        <div className="save-state" role="status">
          <span
            className={`status-dot ${statusWarning ? "warning" : ""}`}
          />
          {statusLabel}
        </div>
      </div>
      <div className="workspace-toolbar">
        <div className="mode-switch" aria-label="Editor mode">
          <button className={!run ? "active" : ""} aria-pressed={!run} onClick={onBuild}>
            ⌘ Build
          </button>
          <button
            className={run ? "active" : ""}
            aria-pressed={!!run}
            onClick={onSimulate}
          >
            ▷ Simulate
          </button>
        </div>
        <span className="toolbar-tip">
          {run
            ? "Walk through your what-ifs."
            : "The happy path goes down. What-ifs go right."}
        </span>
        <div className="history-buttons">
          <button aria-label="Undo" disabled={!!run || !canUndo} onClick={onUndo}>
            ↶
          </button>
          <button aria-label="Redo" disabled={!!run || !canRedo} onClick={onRedo}>
            ↷
          </button>
        </div>
      </div>
    </>
  );
}
