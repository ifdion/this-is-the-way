import { useState } from "react";
import Modal from "../../Modal.tsx";
import type { Flow } from "../../../lib/flow.ts";

interface Props {
  flow: Flow;
  /** Resolves 'deleted' or 'failed'; may throw on a double click. */
  onDelete: () => Promise<"deleted" | "failed">;
  onDeleted: () => void;
  onFailed: (message: string) => void;
  onClose: () => void;
}

export default function DeleteFlowDialog({
  flow,
  onDelete,
  onDeleted,
  onFailed,
  onClose,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  return (
    <Modal title="Delete this flow?" onClose={onClose} busy={deleting}>
      <p>
        This removes <strong>{flow.title}</strong> and all of its cards from
        this browser. This action cannot be undone.
      </p>
      <div className="modal-actions">
        <button onClick={onClose} disabled={deleting}>
          Cancel
        </button>
        <button
          className="destructive"
          disabled={deleting}
          onClick={async () => {
            if (deleting) return;
            setDeleting(true);
            const outcome = await onDelete();
            setDeleting(false);
            if (outcome === "deleted") onDeleted();
            else
              onFailed(
                "This flow could not be deleted. Please retry when browser storage is available.",
              );
          }}
        >
          {deleting ? "Deleting…" : "Delete flow"}
        </button>
      </div>
    </Modal>
  );
}
