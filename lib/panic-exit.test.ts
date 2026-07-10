import { beforeEach, describe, expect, it, vi } from "vitest";
import { PANIC_REDIRECT_URL, panicWipe } from "@/lib/panic-exit";
import { clearVaultKey } from "@/lib/vault-client";
import { listQueuedUploads, enqueueOfflineUpload } from "@/lib/offline-queue";

vi.mock("@/lib/vault-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault-client")>();
  return { ...actual, clearVaultKey: vi.fn() };
});

describe("panic exit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("points to a neutral weather site", () => {
    expect(PANIC_REDIRECT_URL).toBe("https://www.bbc.com/weather");
  });

  it("clears the in-memory key and the encrypted offline queue", async () => {
    await enqueueOfflineUpload({
      id: "panic-q",
      createdAt: Date.now(),
      nonce: "n",
      encryptedMeta: "m",
      ciphertext: new Uint8Array([9]).buffer,
    });
    await panicWipe();
    expect(clearVaultKey).toHaveBeenCalled();
    expect(await listQueuedUploads()).toEqual([]);
  });
});
