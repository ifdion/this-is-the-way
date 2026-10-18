import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  addAlias,
  convertToAlias,
  convertToDecision,
  createFlow,
  deleteNode,
  insertNode,
  retargetAlias,
  updateNode,
  type Flow,
  type Port,
} from "../lib/flow.ts";
import {
  commit,
  createHistory,
  redo,
  undo,
  type History,
} from "../lib/history.ts";
import { FlowRepository } from "../lib/storage.ts";
import { Autosave, type SaveStatus } from "../lib/autosave.ts";
import {
  beginSimulation,
  advance,
  goBack,
  type Simulation,
} from "../lib/simulation.ts";
import { createExample } from "../lib/example.ts";
import { layoutFlow } from "../lib/layout.ts";
import FlowCanvas from "./FlowCanvas.tsx";
import AdSlot from "./AdSlot.tsx";
import LibrarySidebar from "./builder/LibrarySidebar.tsx";
import CollectionScreen from "./builder/CollectionScreen.tsx";
import WorkspaceToolbar from "./builder/WorkspaceToolbar.tsx";
import SimulationPanel from "./builder/SimulationPanel.tsx";
import FlowInspector, { type LoopTarget } from "./builder/FlowInspector.tsx";
import CreateFlowDialog from "./builder/dialogs/CreateFlowDialog.tsx";
import ManageFlowDialog from "./builder/dialogs/ManageFlowDialog.tsx";
import DeleteFlowDialog from "./builder/dialogs/DeleteFlowDialog.tsx";
import LoopTargetDialog from "./builder/dialogs/LoopTargetDialog.tsx";
import DeleteCardDialog from "./builder/dialogs/DeleteCardDialog.tsx";

type Dialog =
  | { kind: "create" }
  | { kind: "manage" | "delete-flow"; flowId: string }
  | { kind: "loop"; target: LoopTarget }
  | { kind: "delete-node"; id: string };

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: "Saved in this browser",
  saving: "Saving…",
  "part-saved": "Some changes are not saved",
  failed: "Save failed",
};

interface Props {
  adClient: string;
  adSlot: string;
  adsEnabled: boolean;
}

export default function FlowBuilder({ adClient, adSlot, adsEnabled }: Props) {
  const [repository] = useState(() => new FlowRepository());
  const [autosave] = useState(() => new Autosave(repository));
  const [histories, setHistories] = useState<Record<string, History>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [run, setRun] = useState<Simulation | null>(null);
  const status = useSyncExternalStore(
    autosave.subscribe,
    () => autosave.status,
    () => autosave.status,
  );
  const editGroup = useRef<string | null>(null);
  const history = activeId ? histories[activeId] : undefined;
  const flow = history?.present;
  const flows = Object.values(histories)
    .map((h) => h.present)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const layout = flow ? layoutFlow(flow) : undefined;
  const selectedPosition = layout?.cards.find((card) => card.id === selected);
  const current = flow && run ? flow.nodes[run.current] : undefined;
  const closeDialog = () => setDialog(null);
  const statusLabel = STATUS_LABELS[status];
  const statusWarning = status === "failed" || status === "part-saved";

  useEffect(() => {
    let alive = true;
    repository
      .list()
      .then((saved) => {
        if (alive) {
          setHistories(
            Object.fromEntries(
              saved.map((item) => [item.id, createHistory(item)]),
            ),
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setLoadFailed(true);
          setError(
            "This browser is blocking local storage. Flows cannot be opened.",
          );
        }
      });
    const warn = (event: BeforeUnloadEvent) => {
      if (autosave.dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      alive = false;
      window.removeEventListener("beforeunload", warn);
    };
  }, [repository, autosave]);

  function selectFlow(item: Flow) {
    editGroup.current = null;
    setActiveId(item.id);
    setSelected(item.start);
    setRun(null);
  }

  function addFlow(item: Flow) {
    setHistories((previous) => ({
      ...previous,
      [item.id]: createHistory(item),
    }));
    selectFlow(item);
    autosave.stage(item);
    setDialog(null);
  }

  function apply(next: Flow, group?: string) {
    if (!history) return;
    const merge = !!group && editGroup.current === group;
    editGroup.current = group || null;
    setHistories((previous) => ({
      ...previous,
      [next.id]: merge
        ? { ...previous[next.id], present: next, future: [] }
        : commit(previous[next.id], next),
    }));
    autosave.stage(next);
  }

  function changeHistory(direction: "undo" | "redo") {
    if (!history || !flow || run) return;
    const next = direction === "undo" ? undo(history) : redo(history);
    if (next === history) return;
    editGroup.current = null;
    setHistories((previous) => ({ ...previous, [flow.id]: next }));
    setSelected(next.present.nodes[selected] ? selected : next.present.start);
    autosave.stage(next.present);
  }

  function add(parent: string, port: Port, kind: "step" | "decision") {
    if (!flow || run) return;
    const next = insertNode(flow, parent, port, kind);
    apply(next);
    setSelected(next.nodes[parent][port]!);
  }

  function jumpToCard(id: string) {
    setSelected(id);
    setFocusRequest({ id });
  }

  function pickLoopTarget(targetId: string) {
    if (!flow || dialog?.kind !== "loop") return;
    const target = dialog.target;
    if (target.purpose === "retarget") {
      apply(retargetAlias(flow, target.alias, targetId));
    } else if (target.purpose === "convert") {
      apply(convertToAlias(flow, target.id, targetId));
    } else {
      const next = addAlias(flow, target.parent, target.port, targetId);
      apply(next);
      setSelected(next.nodes[target.parent][target.port]!);
    }
    closeDialog();
  }

  return (
    <div className="builder-app">
      <header className="app-header">
        <div className="header-brand-group">
          <button
            className="library-toggle"
            aria-label={libraryCollapsed ? "Expand flows" : "Collapse flows"}
            aria-expanded={!libraryCollapsed}
            aria-controls="flow-library"
            onClick={() => setLibraryCollapsed((value) => !value)}
          >
            {libraryCollapsed ? "☰" : "⇤"}
          </button>
          <a className="brand" href="/">
            <span className="brand-mark">↳</span> show the path
            <span className="beta-tag">POC</span>
          </a>
        </div>
        <span className="local-badge">
          <span className="status-dot" /> Local-first workspace
        </span>
        <a className="header-link" href="/">
          About the app ↗
        </a>
      </header>
      <div className="app-layout">
        <aside
          id="flow-library"
          className="library-sidebar"
          hidden={libraryCollapsed}
        >
          <LibrarySidebar
            flows={flows}
            activeId={activeId}
            loading={loading}
            loadFailed={loadFailed}
            onSelect={selectFlow}
            onManage={(flowId) => setDialog({ kind: "manage", flowId })}
            onNew={() => setDialog({ kind: "create" })}
            onShowCollection={() => {
              setActiveId(null);
              setRun(null);
            }}
          />
        </aside>

        <main className="workspace">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {loadFailed ? (
                <button onClick={() => location.reload()}>Reload</button>
              ) : (
                <button onClick={() => autosave.retry()}>Retry saving</button>
              )}
              <button aria-label="Dismiss message" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state" role="status">
              Opening your workspace…
            </div>
          ) : !flow ? (
            <CollectionScreen
              flows={flows}
              loadFailed={loadFailed}
              onCreate={() => setDialog({ kind: "create" })}
              onExample={() => addFlow(createExample())}
              onSelect={selectFlow}
              onManage={(flowId) => setDialog({ kind: "manage", flowId })}
            />
          ) : (
            <>
              <WorkspaceToolbar
                flow={flow}
                run={run}
                canUndo={!!history?.past.length}
                canRedo={!!history?.future.length}
                statusLabel={statusLabel}
                statusWarning={statusWarning}
                onShowCollection={() => {
                  setActiveId(null);
                  setRun(null);
                }}
                onOpenManage={() =>
                  setDialog({ kind: "manage", flowId: flow.id })
                }
                onBuild={() => setRun(null)}
                onSimulate={() => {
                  if (!run) setRun(beginSimulation(flow));
                }}
                onUndo={() => changeHistory("undo")}
                onRedo={() => changeHistory("redo")}
              />
              <div className="editor-area">
                <FlowCanvas
                  key={flow.id}
                  flow={flow}
                  selected={selected}
                  simulation={!!run}
                  current={run?.current}
                  focusRequest={focusRequest}
                  onSelect={setSelected}
                  onAdd={add}
                  onLoop={(parent, port) =>
                    setDialog({
                      kind: "loop",
                      target: { purpose: "new", parent, port },
                    })
                  }
                  onJump={jumpToCard}
                />
                <aside
                  className="inspector-sidebar"
                  aria-label={run ? "Simulation controls" : "Card inspector"}
                >
                  {run && current ? (
                    <SimulationPanel
                      run={run}
                      current={current}
                      onAdvance={(choice) => setRun(advance(flow, run, choice))}
                      onBack={() => setRun(goBack(run))}
                      onRestart={() => setRun(beginSimulation(flow))}
                    />
                  ) : (
                    <FlowInspector
                      flow={flow}
                      selected={selected}
                      selectedPosition={selectedPosition}
                      onAdd={add}
                      onJump={jumpToCard}
                      onSave={(nodeId, fields, field) =>
                        apply(
                          updateNode(flow, nodeId, fields),
                          field ? `${flow.id}:${nodeId}:${field}` : undefined,
                        )
                      }
                      onConvertDecision={(id) =>
                        apply(convertToDecision(flow, id))
                      }
                      onOpenLoop={(target) =>
                        setDialog({ kind: "loop", target })
                      }
                      onDeleteNode={(id) =>
                        setDialog({ kind: "delete-node", id })
                      }
                    />
                  )}
                  <AdSlot
                    client={adClient}
                    slot={adSlot}
                    enabled={adsEnabled}
                  />
                </aside>
              </div>
            </>
          )}
        </main>
      </div>
      {dialog?.kind === "create" && (
        <CreateFlowDialog
          onCreate={(title) => addFlow(createFlow(title))}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "manage" && histories[dialog.flowId] && (
        <ManageFlowDialog
          flow={histories[dialog.flowId].present}
          onRename={(title) => {
            const item = histories[dialog.flowId].present;
            const next = { ...item, title, updatedAt: Date.now() };
            editGroup.current = null;
            setHistories((previous) => ({
              ...previous,
              [item.id]: commit(previous[item.id], next),
            }));
            autosave.stage(next);
            closeDialog();
          }}
          onDuplicate={addFlow}
          onDeleteFlow={() =>
            setDialog({ kind: "delete-flow", flowId: dialog.flowId })
          }
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "delete-flow" && histories[dialog.flowId] && (
        <DeleteFlowDialog
          flow={histories[dialog.flowId].present}
          onDelete={() => autosave.withdraw(dialog.flowId)}
          onDeleted={() => {
            const flowId = dialog.flowId;
            setHistories((previous) => {
              const next = { ...previous };
              delete next[flowId];
              return next;
            });
            if (activeId === flowId) {
              setActiveId(null);
              setRun(null);
            }
            setDialog(null);
          }}
          onFailed={(message) => {
            setError(message);
            setDialog(null);
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "loop" && flow && (
        <LoopTargetDialog
          flow={flow}
          mode={dialog.target}
          onPick={pickLoopTarget}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "delete-node" && flow && (
        <DeleteCardDialog
          flow={flow}
          id={dialog.id}
          onResolve={(reference) => {
            setSelected(reference);
            closeDialog();
          }}
          onDelete={(keep) => {
            apply(deleteNode(flow, dialog.id, keep));
            setSelected(flow.start);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
