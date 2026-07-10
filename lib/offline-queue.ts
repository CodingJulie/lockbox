export const OFFLINE_QUEUE_TTL_MS = 60 * 60 * 1000;
export const OFFLINE_QUEUE_MAX_ITEMS = 10;
export const OFFLINE_QUEUE_DB = "lockbox-offline-queue";

const STORE = "uploads";

export type QueuedUpload = {
  id: string;
  createdAt: number;
  nonce: string;
  encryptedMeta: string;
  type?: string;
  ciphertext: ArrayBuffer;
};

const memory = new Map<string, QueuedUpload>();

export function isQueueItemExpired(item: { createdAt: number }, now = Date.now()): boolean {
  return now - item.createdAt > OFFLINE_QUEUE_TTL_MS;
}

export function isLikelyNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  return error instanceof Error && /network|fetch|offline|failed to fetch/i.test(error.message);
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_QUEUE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function memoryList(): Promise<QueuedUpload[]> {
  const now = Date.now();
  for (const item of memory.values()) {
    if (isQueueItemExpired(item, now)) memory.delete(item.id);
  }
  return [...memory.values()].sort((a, b) => a.createdAt - b.createdAt);
}

async function idbList(): Promise<QueuedUpload[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const items = (await idbRequest(store.getAll())) as QueuedUpload[];
    const now = Date.now();
    const alive: QueuedUpload[] = [];
    for (const item of items) {
      if (isQueueItemExpired(item, now)) {
        store.delete(item.id);
      } else {
        alive.push(item);
      }
    }
    return alive.sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}

export async function listQueuedUploads(): Promise<QueuedUpload[]> {
  return hasIndexedDb() ? idbList() : memoryList();
}

export async function enqueueOfflineUpload(item: QueuedUpload): Promise<void> {
  const existing = await listQueuedUploads();
  if (existing.length >= OFFLINE_QUEUE_MAX_ITEMS) {
    throw new Error("Offline queue is full");
  }
  if (hasIndexedDb()) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    return;
  }
  memory.set(item.id, item);
}

export async function deleteQueuedUpload(id: string): Promise<void> {
  if (hasIndexedDb()) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    return;
  }
  memory.delete(id);
}

export async function wipeOfflineQueue(): Promise<void> {
  memory.clear();
  if (!hasIndexedDb()) return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(OFFLINE_QUEUE_DB);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export function resetOfflineQueueForTests(): void {
  memory.clear();
}
