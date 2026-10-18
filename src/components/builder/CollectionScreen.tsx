import type { Flow } from "../../lib/flow.ts";

interface Props {
  flows: Flow[];
  loadFailed: boolean;
  onCreate: () => void;
  onExample: () => void;
  onSelect: (flow: Flow) => void;
  onManage: (flowId: string) => void;
}

export default function CollectionScreen({
  flows,
  loadFailed,
  onCreate,
  onExample,
  onSelect,
  onManage,
}: Props) {
  return (
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
        <button className="primary" disabled={loadFailed} onClick={onCreate}>
          ＋ Create a flow
        </button>
        <button disabled={loadFailed} onClick={onExample}>
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
              onClick={() => onSelect(item)}
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
              onClick={() => onManage(item.id)}
            >
              ···
            </button>
          </article>
        ))}
        {!flows.length && (
          <div className="empty-library">
            Your next idea starts here.
            <span>Create a blank flow, or take the example for a spin.</span>
          </div>
        )}
      </div>
      <div className="collection-footer">
        <span>● No account needed</span>
        <span>● Automatic layout</span>
        <span>● Yours, in this browser</span>
      </div>
    </div>
  );
}
