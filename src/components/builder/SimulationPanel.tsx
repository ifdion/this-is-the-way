import type { Simulation } from "../../lib/simulation.ts";
import type { FlowNode, Port } from "../../lib/flow.ts";

interface Props {
  run: Simulation;
  current: FlowNode;
  onAdvance: (choice?: Port) => void;
  onBack: () => void;
  onRestart: () => void;
}

export default function SimulationPanel({
  run,
  current,
  onAdvance,
  onBack,
  onRestart,
}: Props) {
  return (
    <section className="inspector">
      <div className="eyebrow">SIMULATION</div>
      <h2>{current.title}</h2>
      {current.description && (
        <p className="simulation-description">{current.description}</p>
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
                onClick={() => onAdvance("next")}
              >
                ↓ {current.yesLabel}
              </button>
              <button onClick={() => onAdvance("no")}>
                → {current.noLabel}
              </button>
            </>
          ) : (
            <button className="primary" onClick={() => onAdvance()}>
              Next step ↓
            </button>
          ))}
      </div>
      <div className="button-pair">
        <button
          disabled={!run.history.length && !run.ended}
          onClick={onBack}
        >
          ← Back
        </button>
        <button onClick={() => onRestart()}>↺ Restart</button>
      </div>
      <small className="simulation-count">
        {run.history.length} transitions taken · diagram unchanged
      </small>
    </section>
  );
}
