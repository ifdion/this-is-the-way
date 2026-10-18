import { useState } from "react";
import Modal from "../../Modal.tsx";
import { layoutFlow } from "../../../lib/layout.ts";
import type { Flow } from "../../../lib/flow.ts";
import type { LoopTarget } from "../FlowInspector.tsx";

interface Props {
  flow: Flow;
  mode: LoopTarget;
  onPick: (cardId: string) => void;
  onClose: () => void;
}

const TITLES = {
  retarget: "Point this loop to another card",
  convert: "Convert this terminal step to a loop",
  new: "Loop to an existing card",
} as const;

const HELP = {
  retarget: "The alias keeps its position; only what it points to changes.",
  convert: "The step becomes a loop reference; undo restores it.",
  new: "The alias follows the original card’s name and contents.",
} as const;

export default function LoopTargetDialog({ flow, mode, onPick, onClose }: Props) {
  const [search, setSearch] = useState("");
  return (
    <Modal title={TITLES[mode.purpose]} onClose={onClose}>
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
              card.id !== flow.nodes[mode.purpose === "retarget" ? mode.alias : ""]?.target &&
              card.id !== (mode.purpose === "convert" ? mode.id : "") &&
              flow.nodes[card.id].title
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((card) => (
            <button key={card.id} onClick={() => onPick(card.id)}>
              <strong>{flow.nodes[card.id].title}</strong>
              <span>{card.path}</span>
            </button>
          ))}
      </div>
      <p className="modal-help">{HELP[mode.purpose]}</p>
    </Modal>
  );
}
