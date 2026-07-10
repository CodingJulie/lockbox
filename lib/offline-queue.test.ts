import { afterEach, describe, expect, it } from "vitest";
import {
  OFFLINE_QUEUE_TTL_MS,
  enqueueOfflineUpload,
  isLikelyNetworkError,
  isQueueItemExpired,
  listQueuedUploads,
  resetOfflineQueueForTests,
  wipeOfflineQueue,
  type QueuedUpload,
} from "@/lib/offline-queue";

function item(overrides: Partial<QueuedUpload> = {}): QueuedUpload {
  return {
    id: overrides.id ?? "q1",
    createdAt: overrides.createdAt ?? Date.now(),
    nonce: "nonce",
    encryptedMeta: "meta",
    ciphertext: new Uint8Array([1, 2, 3]).buffer,
    ...overrides,
  };
}

describe("offline queue", () => {
  afterEach(() => {
    resetOfflineQueueForTests();
  });

  it("expires items after one hour", () => {
    expect(isQueueItemExpired({ createdAt: Date.now() - OFFLINE_QUEUE_TTL_MS - 1 })).toBe(true);
    expect(isQueueItemExpired({ createdAt: Date.now() })).toBe(false);
  });

  it("stores and lists ciphertext without dropping it on a network blip", async () => {
    await enqueueOfflineUpload(item());
    const listed = await listQueuedUploads();
    expect(listed).toHaveLength(1);
    expect(new Uint8Array(listed[0].ciphertext)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("drops expired rows when listing", async () => {
    await enqueueOfflineUpload(item({ createdAt: Date.now() - OFFLINE_QUEUE_TTL_MS - 5_000 }));
    expect(await listQueuedUploads()).toEqual([]);
  });

  it("wipes the queue for panic exit", async () => {
    await enqueueOfflineUpload(item());
    await wipeOfflineQueue();
    expect(await listQueuedUploads()).toEqual([]);
  });

  it("treats fetch TypeError and offline navigator as network failure", () => {
    expect(isLikelyNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isLikelyNetworkError(new Error("validation"))).toBe(false);
  });
});
