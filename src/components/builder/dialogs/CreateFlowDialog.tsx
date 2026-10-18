import Modal from "../../Modal.tsx";

interface Props {
  onCreate: (title: string) => void;
  onClose: () => void;
}

export default function CreateFlowDialog({ onCreate, onClose }: Props) {
  return (
    <Modal title="A new path" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const title = String(
            new FormData(event.currentTarget).get("title") || "",
          ).trim();
          if (title) onCreate(title);
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
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Create flow →</button>
        </div>
      </form>
    </Modal>
  );
}
