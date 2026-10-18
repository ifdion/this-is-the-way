import Modal from "../../Modal.tsx";
import { duplicateFlow, type Flow } from "../../../lib/flow.ts";

interface Props {
  flow: Flow;
  onRename: (title: string) => void;
  onDuplicate: (flow: Flow) => void;
  onDeleteFlow: () => void;
  onClose: () => void;
}

export default function ManageFlowDialog({
  flow,
  onRename,
  onDuplicate,
  onDeleteFlow,
  onClose,
}: Props) {
  return (
    <Modal title="Manage flow" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const title = String(
            new FormData(event.currentTarget).get("title") || "",
          ).trim();
          if (title) onRename(title);
        }}
      >
        <label>
          Flow name
          <input
            name="title"
            defaultValue={flow.title}
            required
            maxLength={100}
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={() => onDuplicate(duplicateFlow(flow))}>
            Duplicate
          </button>
          <button className="primary">Save name</button>
        </div>
        <div className="modal-danger-zone">
          <button type="button" className="danger text-button" onClick={onDeleteFlow}>
            Delete this flow…
          </button>
        </div>
      </form>
    </Modal>
  );
}
