import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  storeVaultKey,
  getStoredVaultKey,
  clearVaultKey,
  verifyVaultKey,
  createVault,
  CreateVaultError,
  getVaultSession,
  storeMasterVaultKey,
  hasVaultPermission,
  fetchItems,
  uploadFile,
  OfflineQueuedError,
} from "@/lib/vault-client";
import { deriveVaultAuth, generateDek, wrapDek, encryptMetadata } from "@/lib/vault-crypto";
import { bytesToBase64url } from "@/lib/vault-key-codec";
import { listQueuedUploads, resetOfflineQueueForTests } from "@/lib/offline-queue";

describe("vault-client session", () => {
  beforeEach(() => clearVaultKey());

  it("stores key in memory only", () => {
    storeVaultKey("test-key");
    expect(getStoredVaultKey()).toBe("test-key");
  });

  it("clears key on logout", () => {
    storeMasterVaultKey("test-key");
    expect(getVaultSession()?.role).toBe("master");
    expect(hasVaultPermission("manage")).toBe(true);
    clearVaultKey();
    expect(getStoredVaultKey()).toBeNull();
    expect(getVaultSession()).toBeNull();
    expect(hasVaultPermission("manage")).toBe(false);
  });
});

describe("verifyVaultKey", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearVaultKey();
  });

  it("returns ok for a valid code and sends HMAC proof instead of the mnemonic or derived key", async () => {
    const key = "quiet-light-bridge-shore-A1B2C3D4";
    const auth = await deriveVaultAuth(key);
    const wrap = await wrapDek(await generateDek(), auth.kek);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        role: "master",
        permissions: ["read", "download", "upload", "manage"],
        wrappedDek: wrap.wrappedDek,
        dekNonce: wrap.dekNonce,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyVaultKey(key)).resolves.toEqual({
      ok: true,
      role: "master",
      permissions: ["read", "download", "upload", "manage"],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.vaultId).toBe(auth.vaultId);
    expect(body.proof).toBe(bytesToBase64url(auth.proof));
    expect(body.authSecret).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(key);
    expect(JSON.stringify(body)).not.toContain(bytesToBase64url(auth.derivedKey));
  });

  it("maps 429 to rate_limited without treating it as a wrong code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(verifyVaultKey("guess")).resolves.toEqual({ ok: false, reason: "rate_limited" });
  });

  it("maps any other failure to invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(verifyVaultKey("guess")).resolves.toEqual({ ok: false, reason: "invalid" });
  });
});

describe("createVault", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearVaultKey();
  });

  it("generates the mnemonic locally and never sends it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { key } = await createVault("en");
    expect(key).toMatch(/^[a-z]+(?:-[a-z]+){3}-[A-F0-9]{8}$/);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.vaultId).toMatch(/^[a-f0-9]{64}$/);
    expect(body.proof).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(body.authSecret).toBeUndefined();
    expect(body.wrappedDek).toBeTruthy();
    expect(body.dekNonce).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(key);
  });

  it("maps 429 to a rate_limited CreateVaultError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Слишком много хранилищ. Попробуйте позже." }),
      })
    );

    const err = await createVault().catch((error) => error);
    expect(err).toBeInstanceOf(CreateVaultError);
    expect(err).toMatchObject({ reason: "rate_limited" });
  });
});

describe("client encrypted metadata", () => {
  const key = "quiet-light-bridge-shore-A1B2C3D4";

  beforeEach(() => {
    vi.unstubAllGlobals();
    clearVaultKey();
  });

  async function unlockWithDek() {
    const derived = await deriveVaultAuth(key);
    const dek = await generateDek();
    const wrap = await wrapDek(dek, derived.kek);
    return { derived, dek, wrap };
  }

  it("decrypts name and MIME from encryptedMeta", async () => {
    const { derived, dek, wrap } = await unlockWithDek();
    const encryptedMeta = await encryptMetadata(
      { name: "secret-note.txt", mimeType: "text/plain" },
      dek
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes("/verify")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              valid: true,
              role: "master",
              permissions: ["read", "download", "upload", "manage"],
              wrappedDek: wrap.wrappedDek,
              dekNonce: wrap.dekNonce,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "item-1",
                vaultId: derived.vaultId,
                type: "text",
                size: 12,
                contentNonce: "nonce",
                encryptedMeta,
                encryptedContent: null,
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        };
      })
    );

    await verifyVaultKey(key);
    const { items } = await fetchItems();
    expect(items[0]).toMatchObject({
      name: "secret-note.txt",
      mimeType: "text/plain",
      type: "text",
      size: 12,
    });
  });

  it("uploads ciphertext and encryptedMeta without a plaintext filename", async () => {
    const { wrap } = await unlockWithDek();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/verify")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            valid: true,
            role: "master",
            permissions: ["read", "download", "upload", "manage"],
            wrappedDek: wrap.wrappedDek,
            dekNonce: wrap.dekNonce,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ item: { id: "1" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    await verifyVaultKey(key);
    await uploadFile(new Blob(["hello"], { type: "image/jpeg" }), "passport.jpg", "file");

    const uploadCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/upload"));
    expect(uploadCall).toBeTruthy();
    const formData = uploadCall![1].body as FormData;
    const file = formData.get("file") as File;
    expect(file.name).toBe("blob");
    expect(formData.get("type")).toBe("file");
    const encryptedMeta = String(formData.get("encryptedMeta"));
    expect(encryptedMeta).toBeTruthy();
    expect(encryptedMeta).not.toContain("passport.jpg");
    expect(encryptedMeta).not.toContain("image/jpeg");
  });

  it("queues an encrypted upload when the network drops", async () => {
    resetOfflineQueueForTests();
    const { wrap } = await unlockWithDek();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("/verify")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            valid: true,
            role: "master",
            permissions: ["read", "download", "upload", "manage"],
            wrappedDek: wrap.wrappedDek,
            dekNonce: wrap.dekNonce,
          }),
        };
      }
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);

    await verifyVaultKey(key);
    await expect(uploadFile(new Blob(["hello"]), "a.bin", "file")).rejects.toBeInstanceOf(
      OfflineQueuedError
    );
    expect(await listQueuedUploads()).toHaveLength(1);
  });
});
