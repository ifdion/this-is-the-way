import { useEffect, useRef, useState } from "react";
import {
  addAlias,
  createFlow,
  deleteNode,
  duplicateFlow,
  insertNode,
  previewDeletion,
  updateNode,
  type DeleteChoice,
  type Flow,
  type FlowNode,
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
import Modal from "./Modal.tsx";

type Dialog =
  | { kind: "create" }
  | { kind: "manage" | "delete-flow"; flowId: string }
  | { kind: "loop"; parent: string; port: Port }
  | { kind: "delete-node"; id: string };
interface Props {
  adClient: string;
  adSlot: string;
  adsEnabled: boolean;
}

export default function FlowBuilder({ adClient, adSlot, adsEnabled }: Props) {
  const [repository] = useState(() => new FlowRepository());
  const [histories, setHistories] = useState<Record<string, History>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState("Saved in this browser");
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [run, setRun] = useState<Simulation | null>(null);
  const [search, setSearch] = useState("");
  const [keep, setKeep] = useState<DeleteChoice>("next");
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const dirty = useRef(false);
  const unsaved = useRef(new Map<string, Flow>());
  const editGroup = useRef<string | null>(null);
  const history = activeId ? histories[activeId] : undefined;
  const flow = history?.present;
  const flows = Object.values(histories)
    .map((h) => h.present)
    .sort((a, b) => b.updatedAt - a.updatedAt);

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
          setLoadFailed(true);
          setLoading(false);
          setError(
            "Browser storage could not be opened. Your saved flows have not been overwritten. Enable browser storage and reload.",
          );
        }
      });
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      alive = false;
      window.removeEventListener("beforeunload", warn);
    };
  }, [repository]);

  function persist(next: Flow) {
    unsaved.current.set(next.id, next);
    dirty.current = true;
    const version = ++revision.current;
    setStatus("Saving…");
    queue.current = queue.current
      .catch(() => {})
      .then(() => repository.save(next))
      .then(() => {
        if (unsaved.current.get(next.id) === next)
          unsaved.current.delete(next.id);
        if (version === revision.current) {
          dirty.current = unsaved.current.size > 0;
          setStatus(
            dirty.current
              ? "Some changes are not saved"
              : "Saved in this browser",
          );
        }
      })
      .catch(() => {
        setStatus("Save failed");
        setError(
          "Changes are still in memory, but could not be saved. Keep this tab open and retry saving.",
        );
      });
  }

  function retrySaving() {
    setError("");
    for (const pending of unsaved.current.values()) persist(pending);
  }

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
    persist(item);
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
    persist(next);
  }

  function changeHistory(direction: "undo" | "redo") {
    if (!history || !flow || run) return;
    const next = direction === "undo" ? undo(history) : redo(history);
    if (next === history) return;
    editGroup.current = null;
    setHistories((previous) => ({ ...previous, [flow.id]: next }));
    setSelected(next.present.nodes[selected] ? selected : next.present.start);
    persist(next.present);
  }

  function add(parent: string, port: Port, kind: "step" | "decision") {
    if (!flow || run) return;
    const next = insertNode(flow, parent, port, kind);
    apply(next);
    setSelected(next.nodes[parent][port]!);
  }

  const selectedNode = flow?.nodes[selected];
  const selectedPosition = flow
    ? layoutFlow(flow).cards.find((card) => card.id === selected)
    : undefined;
  const current = flow && run ? flow.nodes[run.current] : undefined;
  const closeDialog = () => {
    setDialog(null);
    setSearch("");
  };
  const formText = (event: { currentTarget: HTMLFormElement }, name: string) =>
    String(new FormData(event.currentTarget).get(name) || "").trim();

  function pathActions(parent: FlowNode, port: Port, label: string) {
    return (
      <div className="path-actions" key={port}>
        <span className="field-label">{label}</span>
        <div className="button-pair">
          <button onClick={() => add(parent.id, port, "step")}>
            ＋ Add step
          </button>
          <button onClick={() => add(parent.id, port, "decision")}>
            ◇ Add branch
          </button>
        </div>
        {!parent[port] && (
          <button
            className="text-button loop-action"
            onClick={() => {
              setSearch("");
              setDialog({ kind: "loop", parent: parent.id, port });
            }}
          >
            ↩ Loop to an existing step
          </button>
        )}
        {parent[port] && (
          <small>Inserts before the existing continuation.</small>
        )}
      </div>
    );
  }

  return (
    <div className="builder-app">
      <header className="app-header">
        <a className="brand" href="/">
          <span className="brand-mark">↳</span> show the path
          <span className="beta-tag">POC</span>
        </a>
        <span className="local-badge">
          <span className="status-dot" /> Local-first workspace
        </span>
        <a className="header-link" href="/">
          About the app ↗
        </a>
      </header>
      <div className="app-layout">
        <aside className="library-sidebar">
          <div className="sidebar-heading">
            <button
              className="text-button"
              onClick={() => {
                setActiveId(null);
                setRun(null);
              }}
            >
              YOUR FLOWS
            </button>
            <span>{flows.length.toString().padStart(2, "0")}</span>
          </div>
          <button
            className="new-flow-button"
            disabled={loading || loadFailed}
            onClick={() => setDialog({ kind: "create" })}
          >
            ＋ New flow
          </button>
          <nav className="flow-nav" aria-label="Saved flows">
            {flows.map((item) => (
              <div
                className={`flow-nav-row ${activeId === item.id ? "active" : ""}`}
                key={item.id}
              >
                <button
                  className="flow-nav-select"
                  onClick={() => selectFlow(item)}
                >
                  <span>⌘</span>
                  <span>{item.title}</span>
                </button>
                <button
                  className="flow-menu-button"
                  aria-label={`Manage ${item.title}`}
                  onClick={() => setDialog({ kind: "manage", flowId: item.id })}
                >
                  ···
                </button>
              </div>
            ))}
          </nav>
          <div className="sidebar-note">
            <span>◉</span>
            <strong>A space to think clearly.</strong>
            <p>
              One step at a time.
              <br />
              One possibility at a time.
            </p>
          </div>
          <div className="storage-note">
            Stored in this browser only.
            <br />
            Clearing site data removes your flows.
          </div>
        </aside>

        <main className="workspace">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {loadFailed ? (
                <button onClick={() => location.reload()}>Reload</button>
              ) : (
                <button onClick={retrySaving}>Retry saving</button>
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
            <div className="collection">
              <div className="eyebrow">YOUR IDEAS, CONNECTED</div>
              <h1>
                A little structure.
                <br />A lot more clarity.
              </h1>
              <p>
                Map the happy path. Explore the what-ifs.
                <br />
                Build a flow that makes your thinking visible.
              </p>
              <div className="collection-actions">
                <button
                  className="primary"
                  disabled={loadFailed}
                  onClick={() => setDialog({ kind: "create" })}
                >
                  ＋ Create a flow
                </button>
                <button
                  disabled={loadFailed}
                  onClick={() => addFlow(createExample())}
                >
                  Try an example ↗
                </button>
              </div>
              <div className="collection-title">
                <h2>Your flows</h2>
                <span>{flows.length} saved locally</span>
              </div>
              <div className="flow-grid">
                {flows.map((item) => (
                  <article className="collection-card" key={item.id}>
                    <button
                      className="collection-card-open"
                      onClick={() => selectFlow(item)}
                    >
                      <span className="flow-symbol">⌘</span>
                      <h3>{item.title}</h3>
                      <p>
                        {Object.keys(item.nodes).length - 1} cards ·{" "}
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </p>
                      <span className="text-link">Open flow →</span>
                    </button>
                    <button
                      className="collection-manage"
                      aria-label={`Manage ${item.title}`}
                      onClick={() =>
                        setDialog({ kind: "manage", flowId: item.id })
                      }
                    >
                      ···
                    </button>
                  </article>
                ))}
                {!flows.length && (
                  <div className="empty-library">
                    Your next idea starts here.
                    <span>
                      Create a blank flow, or take the example for a spin.
                    </span>
                  </div>
                )}
              </div>
              <div className="collection-footer">
                <span>● No account needed</span>
                <span>● Automatic layout</span>
                <span>● Yours, in this browser</span>
              </div>
            </div>
          ) : (
            <>
              <div className="workspace-heading">
                <div>
                  <div className="breadcrumb">
                    <button
                      className="text-button"
                      onClick={() => {
                        setActiveId(null);
                        setRun(null);
                      }}
                    >
                      Your flows
                    </button>
                    <span>/</span>
                    <span>{run ? "Simulation" : "Builder"}</span>
                  </div>
                  <button
                    className="flow-title-button"
                    onClick={() =>
                      !run && setDialog({ kind: "manage", flowId: flow.id })
                    }
                  >
                    <h1>{flow.title}</h1>
                    {!run && <span>✎</span>}
                  </button>
                </div>
                <div className="save-state" role="status">
                  <span
                    className={`status-dot ${status.includes("failed") || status.includes("not saved") ? "warning" : ""}`}
                  />
                  {status}
                </div>
              </div>
              <div className="workspace-toolbar">
                <div className="mode-switch" aria-label="Editor mode">
                  <button
                    className={!run ? "active" : ""}
                    aria-pressed={!run}
                    onClick={() => setRun(null)}
                  >
                    ⌘ Build
                  </button>
                  <button
                    className={run ? "active" : ""}
                    aria-pressed={!!run}
                    onClick={() => {
                      if (!run) setRun(beginSimulation(flow));
                    }}
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
                  <button
                    aria-label="Undo"
                    disabled={!!run || !history?.past.length}
                    onClick={() => changeHistory("undo")}
                  >
                    ↶
                  </button>
                  <button
                    aria-label="Redo"
                    disabled={!!run || !history?.future.length}
                    onClick={() => changeHistory("redo")}
                  >
                    ↷
                  </button>
                </div>
              </div>
              <div className="editor-area">
                <FlowCanvas
                  key={flow.id}
                  flow={flow}
                  selected={selected}
                  simulation={!!run}
                  current={run?.current}
                  onSelect={setSelected}
                  onAdd={add}
                />
                <aside
                  className="inspector-sidebar"
                  aria-label={run ? "Simulation controls" : "Card inspector"}
                >
                  {run && current ? (
                    <section className="inspector">
                      <div className="eyebrow">SIMULATION</div>
                      <h2>{current.title}</h2>
                      {current.description && (
                        <p className="simulation-description">
                          {current.description}
                        </p>
                      )}
                      <div className="simulation-state">
                        {run.ended
                          ? "No next step · path complete"
                          : current.kind === "decision"
                            ? "Choose an outcome to continue."
                            : "You are here. Ready for the next step?"}
                      </div>
                      <div className="simulation-choices">
                        {!run.ended &&
                          (current.kind === "decision" ? (
                            <>
                              <button
                                className="primary"
                                onClick={() =>
                                  setRun(advance(flow, run, "next"))
                                }
                              >
                                ↓ {current.yesLabel}
                              </button>
                              <button
                                onClick={() => setRun(advance(flow, run, "no"))}
                              >
                                → {current.noLabel}
                              </button>
                            </>
                          ) : (
                            <button
                              className="primary"
                              onClick={() => setRun(advance(flow, run))}
                            >
                              Next step ↓
                            </button>
                          ))}
                      </div>
                      <div className="button-pair">
                        <button
                          disabled={!run.history.length && !run.ended}
                          onClick={() => setRun(goBack(run))}
                        >
                          ← Back
                        </button>
                        <button onClick={() => setRun(beginSimulation(flow))}>
                          ↺ Restart
                        </button>
                      </div>
                      <small className="simulation-count">
                        {run.history.length} transitions taken · diagram
                        unchanged
                      </small>
                    </section>
                  ) : (
                    <section className="inspector">
                      <div className="eyebrow">
                        {selectedNode?.kind === "alias"
                          ? "LOOP REFERENCE"
                          : selectedNode?.kind === "decision"
                            ? "BOOLEAN DECISION"
                            : selectedNode?.kind === "start"
                              ? "ENTRY POINT"
                              : selectedNode
                                ? "STEP DETAILS"
                                : "CONTINUE THE PATH"}
                      </div>
                      {selectedNode ? (
                        <>
                          {selectedNode.kind === "alias" ? (
                            <>
                              <h2>
                                ↩ {flow.nodes[selectedNode.target!]?.title}
                              </h2>
                              <p className="inspector-help">
                                A reference, not a copy. Simulation jumps to the
                                original card.
                              </p>
                              <button
                                onClick={() =>
                                  setSelected(selectedNode.target!)
                                }
                              >
                                Go to original step ↗
                              </button>
                            </>
                          ) : (
                            <NodeEditor
                              key={`${flow.id}:${selectedNode.id}`}
                              node={selectedNode}
                              onSave={(fields, field) =>
                                apply(
                                  updateNode(flow, selectedNode.id, fields),
                                  field
                                    ? `${flow.id}:${selectedNode.id}:${field}`
                                    : undefined,
                                )
                              }
                            />
                          )}
                          {selectedNode.kind !== "alias" &&
                            pathActions(
                              selectedNode,
                              "next",
                              selectedNode.kind === "decision"
                                ? "↓ YES · HAPPY PATH"
                                : "↓ CONTINUE BELOW",
                            )}
                          {selectedNode.kind === "decision" &&
                            pathActions(
                              selectedNode,
                              "no",
                              "→ NO · ALTERNATIVE",
                            )}
                          {selectedNode.kind !== "start" && (
                            <button
                              className="danger text-button delete-card"
                              onClick={() => {
                                setKeep("next");
                                setDialog({
                                  kind: "delete-node",
                                  id: selectedNode.id,
                                });
                              }}
                            >
                              Delete{" "}
                              {selectedNode.kind === "alias" ? "alias" : "card"}
                              …
                            </button>
                          )}
                        </>
                      ) : selectedPosition?.parent && selectedPosition.port ? (
                        <>
                          <h2>What happens next?</h2>
                          <p className="inspector-help">
                            Add a step, ask a boolean question, or loop to an
                            existing card.
                          </p>
                          {pathActions(
                            flow.nodes[selectedPosition.parent],
                            selectedPosition.port,
                            selectedPosition.port === "no"
                              ? "→ ALTERNATIVE"
                              : "↓ NEXT",
                          )}
                        </>
                      ) : (
                        <p>Select a card to edit it.</p>
                      )}
                    </section>
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
        <Modal title="A new path" onClose={closeDialog}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const title = formText(event, "title");
              if (title) addFlow(createFlow(title));
            }}
          >
            <label>
              Flow name
              <input
                name="title"
                placeholder="e.g. Customer onboarding"
                required
                maxLength={100}
                autoFocus
              />
            </label>
            <p className="modal-help">
              Start small. You can rename it at any time.
            </p>
            <div className="modal-actions">
              <button type="button" onClick={closeDialog}>
                Cancel
              </button>
              <button className="primary">Create flow →</button>
            </div>
          </form>
        </Modal>
      )}
      {dialog?.kind === "manage" && histories[dialog.flowId] && (
        <Modal title="Manage flow" onClose={closeDialog}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const title = formText(event, "title");
              if (!title) return;
              const item = histories[dialog.flowId].present;
              const next = { ...item, title, updatedAt: Date.now() };
              setHistories((previous) => ({
                ...previous,
                [item.id]: commit(previous[item.id], next),
              }));
              persist(next);
              closeDialog();
            }}
          >
            <label>
              Flow name
              <input
                name="title"
                defaultValue={histories[dialog.flowId].present.title}
                required
                maxLength={100}
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() =>
                  addFlow(duplicateFlow(histories[dialog.flowId].present))
                }
              >
                Duplicate
              </button>
              <button className="primary">Save name</button>
            </div>
            <div className="modal-danger-zone">
              <button
                type="button"
                className="danger text-button"
                onClick={() =>
                  setDialog({ kind: "delete-flow", flowId: dialog.flowId })
                }
              >
                Delete this flow…
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog?.kind === "delete-flow" && (
        <Modal title="Delete this flow?" onClose={closeDialog}>
          <p>
            This removes{" "}
            <strong>{histories[dialog.flowId]?.present.title}</strong> and all
            its cards from this browser. This action cannot be undone.
          </p>
          <div className="modal-actions">
            <button onClick={closeDialog}>Cancel</button>
            <button
              className="destructive"
              onClick={async () => {
                const id = dialog.flowId;
                try {
                  await queue.current;
                  await repository.remove(id);
                  unsaved.current.delete(id);
                  dirty.current = unsaved.current.size > 0;
                  setHistories((previous) => {
                    const next = { ...previous };
                    delete next[id];
                    return next;
                  });
                  if (activeId === id) {
                    setActiveId(null);
                    setRun(null);
                  }
                  closeDialog();
                } catch {
                  setError(
                    "This flow could not be deleted. Please retry when browser storage is available.",
                  );
                  closeDialog();
                }
              }}
            >
              Delete flow
            </button>
          </div>
        </Modal>
      )}
      {dialog?.kind === "loop" && flow && (
        <Modal title="Loop to an existing card" onClose={closeDialog}>
          <label>
            Find a step or decision
            <input
              placeholder="Search by name…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
          </label>
          <div className="target-list">
            {layoutFlow(flow)
              .cards.filter(
                (card) =>
                  !card.placeholder &&
                  flow.nodes[card.id].kind !== "alias" &&
                  flow.nodes[card.id].title
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((card) => (
                <button
                  key={card.id}
                  onClick={() => {
                    const next = addAlias(
                      flow,
                      dialog.parent,
                      dialog.port,
                      card.id,
                    );
                    apply(next);
                    setSelected(next.nodes[dialog.parent][dialog.port]!);
                    closeDialog();
                  }}
                >
                  <strong>{flow.nodes[card.id].title}</strong>
                  <span>{card.path}</span>
                </button>
              ))}
          </div>
          <p className="modal-help">
            The alias follows the original card’s name and contents.
          </p>
        </Modal>
      )}
      {dialog?.kind === "delete-node" && flow && (
        <DeleteCardDialog
          flow={flow}
          id={dialog.id}
          keep={keep}
          onKeep={setKeep}
          onClose={closeDialog}
          onResolve={(id) => {
            setSelected(id);
            closeDialog();
          }}
          onDelete={() => {
            apply(deleteNode(flow, dialog.id, keep));
            setSelected(flow.start);
            closeDialog();
          }}
        />
      )}
    </div>
  );
}

function NodeEditor({
  node,
  onSave,
}: {
  node: FlowNode;
  onSave: (fields: Partial<FlowNode>, field?: string) => void;
}) {
  return (
    <form
      className="node-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const title = String(data.get("title") || "").trim();
        if (!title) return;
        onSave({
          title,
          description: String(data.get("description") || "").trim(),
          yesLabel: String(data.get("yesLabel") || "Yes").trim() || "Yes",
          noLabel: String(data.get("noLabel") || "No").trim() || "No",
        });
      }}
    >
      <label>
        {node.kind === "decision" ? "Question" : "Title"}
        <input
          name="title"
          value={node.title}
          onChange={(event) => onSave({ title: event.target.value }, "title")}
          onBlur={() => {
            if (!node.title.trim())
              onSave(
                {
                  title:
                    node.kind === "decision" ? "Condition?" : "Untitled step",
                },
                "title",
              );
          }}
          required
          maxLength={100}
        />
      </label>
      <label>
        Description <span className="optional">optional</span>
        <textarea
          name="description"
          value={node.description}
          onChange={(event) =>
            onSave({ description: event.target.value }, "description")
          }
          placeholder="A little more context…"
          rows={3}
          maxLength={2000}
        />
      </label>
      {node.kind === "decision" && (
        <div className="outcome-fields">
          <label>
            ↓ Yes label
            <input
              name="yesLabel"
              value={node.yesLabel}
              onChange={(event) =>
                onSave({ yesLabel: event.target.value }, "yesLabel")
              }
              onBlur={() => {
                if (!node.yesLabel.trim())
                  onSave({ yesLabel: "Yes" }, "yesLabel");
              }}
              required
              maxLength={40}
            />
          </label>
          <label>
            → No label
            <input
              name="noLabel"
              value={node.noLabel}
              onChange={(event) =>
                onSave({ noLabel: event.target.value }, "noLabel")
              }
              onBlur={() => {
                if (!node.noLabel.trim()) onSave({ noLabel: "No" }, "noLabel");
              }}
              required
              maxLength={40}
            />
          </label>
        </div>
      )}
      <button className="save-details" type="submit">
        Save changes
      </button>
    </form>
  );
}

function DeleteCardDialog({
  flow,
  id,
  keep,
  onKeep,
  onClose,
  onResolve,
  onDelete,
}: {
  flow: Flow;
  id: string;
  keep: DeleteChoice;
  onKeep: (choice: DeleteChoice) => void;
  onClose: () => void;
  onResolve: (id: string) => void;
  onDelete: () => void;
}) {
  const node = flow.nodes[id];
  const plan = previewDeletion(flow, id, keep);
  return (
    <Modal title="Delete card" onClose={onClose}>
      {node.kind === "decision" ? (
        <label>
          What should happen to its paths?
          <select
            value={keep}
            onChange={(event) => onKeep(event.target.value as DeleteChoice)}
          >
            <option value="next">Keep Yes path; remove No path</option>
            <option value="no">Keep No path; remove Yes path</option>
            <option value="all">Remove both downstream paths</option>
          </select>
        </label>
      ) : (
        <p>
          The previous card reconnects to the next card. Downstream steps are
          preserved.
        </p>
      )}
      <div className="deletion-preview">
        <strong>
          {plan.removed.length} card{plan.removed.length === 1 ? "" : "s"} will
          be removed
        </strong>
        <ul>
          {plan.removed.map((removed) => (
            <li key={removed}>
              {flow.nodes[removed].kind === "alias"
                ? `Alias → ${flow.nodes[flow.nodes[removed].target!]?.title}`
                : flow.nodes[removed].title}
            </li>
          ))}
        </ul>
      </div>
      {plan.references.length > 0 && (
        <div className="reference-warning">
          <p>Resolve these aliases first so no loops point to deleted cards:</p>
          {plan.references.map((reference) => (
            <button key={reference} onClick={() => onResolve(reference)}>
              Go to alias → {flow.nodes[flow.nodes[reference].target!].title}
            </button>
          ))}
        </div>
      )}
      <p className="modal-help">Card deletion can be undone.</p>
      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="destructive"
          disabled={plan.references.length > 0}
          onClick={onDelete}
        >
          Delete card{plan.removed.length > 1 ? "s" : ""}
        </button>
      </div>
    </Modal>
  );
}
