import type { Flow } from "./flow.ts";

/**
 * Autosave owns everything about writing flows to storage in the background:
 * the serial save queue, per-flow revision control, the pending-change map,
 * retry, deletion races, and the save-status state the UI mirrors.
 * Storage itself is a FlowWriter adapter; Autosave never touches IndexedDB.
 */
export type SaveStatus = "saved" | "saving" | "part-saved" | "failed";

export interface FlowWriter {
  save(flow: Flow): Promise<void>;
  remove(id: string): Promise<void>;
}

export class Autosave {
  #repository: FlowWriter;
  #queue = Promise.resolve();
  #revision = 0;
  #unsaved = new Map<string, Flow>();
  #dirty = false;
  #deletingIds = new Set<string>();
  #status: SaveStatus = "saved";
  #listeners = new Set<() => void>();

  constructor(repository: FlowWriter) {
    this.#repository = repository;
  }

  /** Snapshot for useSyncExternalStore; identity changes only on a real transition. */
  get status(): SaveStatus {
    return this.#status;
  }

  /** Whether the beforeunload warn should fire. */
  get dirty(): boolean {
    return this.#dirty;
  }

  /** Bound so it can be passed directly to useSyncExternalStore. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Record a changed flow and let it fall through the serial save queue. */
  stage(flow: Flow) {
    if (this.#deletingIds.has(flow.id)) return;
    this.#unsaved.set(flow.id, flow);
    this.#dirty = true;
    const version = ++this.#revision;
    this.#setStatus("saving");
    this.#queue = this.#queue
      .catch(() => {})
      .then(() => this.#repository.save(flow))
      .then(() => {
        if (this.#unsaved.get(flow.id) === flow)
          this.#unsaved.delete(flow.id);
        if (version === this.#revision) {
          this.#dirty = this.#unsaved.size > 0;
          this.#setStatus(this.#dirty ? "part-saved" : "saved");
        }
      })
      .catch(() => this.#setStatus("failed"));
  }

  /** Re-stage everything still pending after a failure. */
  retry() {
    for (const pending of [...this.#unsaved.values()]) this.stage(pending);
  }

  /**
   * Remove a deleted flow from storage after any pending save for it.
   * Resolves 'deleted', or 'failed' when storage is unavailable — the flow
   * becomes staging-eligible again either way.
   */
  withdraw(id: string): Promise<"deleted" | "failed"> {
    if (this.#deletingIds.has(id))
      throw new Error("A deletion is already in progress for this flow");
    this.#deletingIds.add(id);
    const removal = this.#queue
      .catch(() => {})
      .then(() => this.#repository.remove(id))
      .then((): "deleted" | "failed" => {
        this.#unsaved.delete(id);
        this.#dirty = this.#unsaved.size > 0;
        return "deleted";
      })
      .catch((): "failed" => {
        this.#deletingIds.delete(id);
        this.#dirty = this.#unsaved.size > 0;
        return "failed";
      });
    this.#queue = removal.then(() => {}, () => {});
    return removal;
  }

  #setStatus(value: SaveStatus) {
    this.#status = value;
    for (const listener of this.#listeners) listener();
  }
}
