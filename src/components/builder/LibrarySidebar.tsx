import type { Flow } from "../../lib/flow.ts";

interface Props {
  flows: Flow[];
  activeId: string | null;
  loading: boolean;
  loadFailed: boolean;
  onSelect: (flow: Flow) => void;
  onManage: (flowId: string) => void;
  onNew: () => void;
  onShowCollection: () => void;
}

export default function LibrarySidebar({
  flows,
  activeId,
  loading,
  loadFailed,
  onSelect,
  onManage,
  onNew,
  onShowCollection,
}: Props) {
  return (
    <>
      <div className="sidebar-heading">
        <button className="text-button" onClick={onShowCollection}>
          YOUR FLOWS
        </button>
        <span>{flows.length.toString().padStart(2, "0")}</span>
      </div>
      <button
        className="new-flow-button"
        disabled={loading || loadFailed}
        onClick={onNew}
      >
        ＋ New flow
      </button>
      <nav className="flow-nav" aria-label="Saved flows">
        {flows.map((item) => (
          <div
            className={`flow-nav-row ${activeId === item.id ? "active" : ""}`}
            key={item.id}
          >
            <button className="flow-nav-select" onClick={() => onSelect(item)}>
              <span>⌘</span>
              <span>{item.title}</span>
            </button>
            <button
              className="flow-menu-button"
              aria-label={`Manage ${item.title}`}
              onClick={() => onManage(item.id)}
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
    </>
  );
}
