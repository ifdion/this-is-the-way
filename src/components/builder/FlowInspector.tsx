import type { CardPosition } from "../../lib/layout.ts";
import type { Flow, FlowNode, Port } from "../../lib/flow.ts";

export type LoopTarget =
  | { purpose: "new"; parent: string; port: Port }
  | { purpose: "retarget"; alias: string }
  | { purpose: "convert"; id: string };

interface Props {
  flow: Flow;
  selected: string;
  selectedPosition?: CardPosition;
  onAdd: (parent: string, port: Port, kind: "step" | "decision") => void;
  onJump: (id: string) => void;
  onSave: (nodeId: string, fields: Partial<FlowNode>, field?: string) => void;
  onConvertDecision: (id: string) => void;
  onOpenLoop: (target: LoopTarget) => void;
  onDeleteNode: (id: string) => void;
}

export default function FlowInspector({
  flow,
  selected,
  selectedPosition,
  onAdd,
  onJump,
  onSave,
  onConvertDecision,
  onOpenLoop,
  onDeleteNode,
}: Props) {
  const selectedNode = flow.nodes[selected];

  function pathActions(parent: FlowNode, port: Port, label: string) {
    return (
      <div className="path-actions" key={port}>
        <span className="field-label">{label}</span>
        <div className="button-pair">
          <button onClick={() => onAdd(parent.id, port, "step")}>
            ＋ Add step
          </button>
          <button onClick={() => onAdd(parent.id, port, "decision")}>
            ◇ Add branch
          </button>
        </div>
        {!parent[port] && (
          <button
            className="text-button loop-action"
            onClick={() =>
              onOpenLoop({ purpose: "new", parent: parent.id, port })
            }
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
              <h2>↩ {flow.nodes[selectedNode.target!]?.title}</h2>
              <p className="inspector-help">
                A reference, not a copy. Simulation jumps to the original card.
              </p>
              <button onClick={() => onJump(selectedNode.target!)}>
                Go to original step ↗
              </button>
              <button
                onClick={() =>
                  onOpenLoop({ purpose: "retarget", alias: selectedNode.id })
                }
              >
                ⇄ Change loop target…
              </button>
            </>
          ) : (
            <NodeEditor
              key={selectedNode.id}
              node={selectedNode}
              onSave={(fields, field) => onSave(selectedNode.id, fields, field)}
            />
          )}
          {selectedNode.kind === "step" && (
            <button
              className="convert-card"
              onClick={() => onConvertDecision(selectedNode.id)}
            >
              ◆ Convert to decision
            </button>
          )}
          {selectedNode.kind === "step" && !selectedNode.next && (
            <button
              className="convert-card"
              onClick={() =>
                onOpenLoop({ purpose: "convert", id: selectedNode.id })
              }
            >
              ↩ Convert to loop to…
            </button>
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
            pathActions(selectedNode, "no", "→ NO · ALTERNATIVE")}
          {selectedNode.kind !== "start" && (
            <button
              className="danger text-button delete-card"
              onClick={() => onDeleteNode(selectedNode.id)}
            >
              Delete {selectedNode.kind === "alias" ? "alias" : "card"}…
            </button>
          )}
        </>
      ) : selectedPosition?.parent && selectedPosition.port ? (
        <>
          <h2>What happens next?</h2>
          <p className="inspector-help">
            Add a step, ask a boolean question, or loop to an existing card.
          </p>
          {pathActions(
            flow.nodes[selectedPosition.parent],
            selectedPosition.port,
            selectedPosition.port === "no" ? "→ ALTERNATIVE" : "↓ NEXT",
          )}
        </>
      ) : (
        <p>Select a card to edit it.</p>
      )}
    </section>
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
