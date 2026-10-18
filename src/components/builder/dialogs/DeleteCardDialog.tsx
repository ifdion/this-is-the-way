import { useState } from "react";
import Modal from "../../Modal.tsx";
import {
  previewDeletion,
  type DeleteChoice,
  type Flow,
} from "../../../lib/flow.ts";

interface Props {
  flow: Flow;
  id: string;
  onResolve: (id: string) => void;
  onDelete: (keep: DeleteChoice) => void;
  onClose: () => void;
}

export default function DeleteCardDialog({
  flow,
  id,
  onResolve,
  onDelete,
  onClose,
}: Props) {
  const node = flow.nodes[id];
  const [keep, setKeep] = useState<DeleteChoice | "">(
    node.kind === "decision" ? "" : "next",
  );
  const plan = keep ? previewDeletion(flow, id, keep) : null;
  return (
    <Modal title="Delete card" onClose={onClose}>
      {node.kind === "decision" ? (
        <label>
          What should happen to its paths?
          <select
            value={keep}
            onChange={(event) =>
              setKeep(event.target.value as DeleteChoice | "")
            }
          >
            <option value="" disabled>
              Choose which path to keep…
            </option>
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
      {plan && (
        <div className="deletion-preview">
          <strong>
            {plan.removed.length} card{plan.removed.length === 1 ? "" : "s"}{" "}
            will be removed
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
      )}
      {plan && plan.references.length > 0 && (
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
          disabled={!plan || plan.references.length > 0}
          onClick={() => keep && onDelete(keep)}
        >
          Delete card{plan && plan.removed.length > 1 ? "s" : ""}
        </button>
      </div>
    </Modal>
  );
}
