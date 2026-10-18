import type { Flow } from "./flow.ts";

/** The browser-only adapter. No editing or layout logic depends on IndexedDB. */
export class FlowRepository {
  private connection: Promise<IDBDatabase> | undefined;
  private factory: IDBFactory;
  private name: string;

  constructor(factory: IDBFactory = indexedDB, name = "this-is-the-way") {
    this.factory = factory;
    this.name = name;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.connection) {
      this.connection = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open(this.name, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("flows", { keyPath: "id" });
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(
            new Error("Close other builder tabs to upgrade browser storage."),
          );
        request.onsuccess = () => {
          request.result.onversionchange = () => {
            request.result.close();
            this.connection = undefined;
          };
          resolve(request.result);
        };
      }).catch((error) => {
        this.connection = undefined;
        throw error;
      });
    }
    return this.connection;
  }

  private async transact<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("flows", mode);
      const request = action(transaction.objectStore("flows"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(
          transaction.error || new Error("Browser storage transaction failed"),
        );
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async list(): Promise<Flow[]> {
    const flows = await this.transact<Flow[]>("readonly", (store) =>
      store.getAll(),
    );
    return flows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async save(flow: Flow): Promise<void> {
    await this.transact("readwrite", (store) => store.put(flow));
  }

  async remove(id: string): Promise<void> {
    await this.transact("readwrite", (store) => store.delete(id));
  }

  close(): void {
    void this.connection?.then((db) => db.close());
    this.connection = undefined;
  }
}
