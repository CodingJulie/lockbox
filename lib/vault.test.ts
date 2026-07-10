// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  createVault: vi.fn(),
  getVault: vi.fn(),
  updateVaultKeyHash: vi.fn(),
  listEvidence: vi.fn(),
  getEvidence: vi.fn(),
  createEvidence: vi.fn(),
  insertAccessKey: vi.fn(),
  getAccessKeyById: vi.fn(),
  listAccessKeysByVault: vi.fn(),
  countActiveAccessKeys: vi.fn(),
  revokeAccessKey: vi.fn(),
  updateAccessKeyHash: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
}));

import {
  createVault,
  getVault,
  updateVaultKeyHash,
  insertAccessKey,
  getAccessKeyById,
  countActiveAccessKeys,
  createEvidence,
} from "@/lib/db";
import { hashVaultSecret } from "@/lib/vault-secret";
import {
  authenticateVault,
  createNewVault,
  createVaultAccessKey,
  AccessKeyLimitError,
  findKnownVaultId,
  VaultExistsError,
  saveFileEvidence,
  saveTextEvidence,
  toPublicEvidence,
} from "@/lib/vault";
import type { EvidenceRecord } from "@/lib/types";
import { MASTER_PERMISSIONS, MAX_ACTIVE_ACCESS_KEYS } from "@/lib/vault-permissions";

const createVaultMock = vi.mocked(createVault);
const createEvidenceMock = vi.mocked(createEvidence);
const getVaultMock = vi.mocked(getVault);
const updateVaultKeyHashMock = vi.mocked(updateVaultKeyHash);
const getAccessKeyByIdMock = vi.mocked(getAccessKeyById);
const insertAccessKeyMock = vi.mocked(insertAccessKey);
const countActiveAccessKeysMock = vi.mocked(countActiveAccessKeys);

const VAULT_ID = "ab".repeat(32);
const PROOF = "cd".repeat(32);
const AUTH = { vaultId: VAULT_ID, proof: PROOF };
const WRAP = {
  wrappedDek: Buffer.alloc(48, 7).toString("base64url"),
  dekNonce: Buffer.alloc(12, 3).toString("base64url"),
};

function createdVault(vaultId = VAULT_ID) {
  return {
    id: vaultId,
    keyHash: "hash",
    wrappedDek: WRAP.wrappedDek,
    dekNonce: WRAP.dekNonce,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("vault HMAC proof hashing", () => {
  beforeEach(() => {
    createVaultMock.mockReset();
    getVaultMock.mockReset();
    updateVaultKeyHashMock.mockReset();
    getAccessKeyByIdMock.mockReset();
    insertAccessKeyMock.mockReset();
    countActiveAccessKeysMock.mockReset();
    createVaultMock.mockResolvedValue(createdVault());
    updateVaultKeyHashMock.mockResolvedValue();
    getAccessKeyByIdMock.mockResolvedValue(null);
    getVaultMock.mockResolvedValue(null);
    countActiveAccessKeysMock.mockResolvedValue(0);
  });

  it("stores an Argon2id hash of the HMAC proof when creating a vault", async () => {
    const { vaultId } = await createNewVault({ ...AUTH, ...WRAP });

    expect(vaultId).toBe(VAULT_ID);
    expect(createVaultMock).toHaveBeenCalledOnce();
    const [storedId, keyHash, wrap] = createVaultMock.mock.calls[0];
    expect(storedId).toBe(VAULT_ID);
    expect(keyHash.startsWith("$argon2id$")).toBe(true);
    expect(wrap).toEqual(WRAP);
  });

  it("authenticates a new vault with Argon2id as master", async () => {
    const { vaultId } = await createNewVault({ ...AUTH, ...WRAP });
    const storedHash = createVaultMock.mock.calls[0][1];
    getVaultMock.mockResolvedValue({
      ...createdVault(vaultId),
      keyHash: storedHash,
    });

    await expect(authenticateVault(AUTH)).resolves.toEqual({
      vaultId,
      role: "master",
      permissions: MASTER_PERMISSIONS,
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
    });
    expect(updateVaultKeyHashMock).not.toHaveBeenCalled();
  });

  it("rejects a legacy vault that has no proof hash", async () => {
    getVaultMock.mockResolvedValue({
      id: VAULT_ID,
      keyHash: null,
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(authenticateVault(AUTH)).resolves.toBeNull();
    expect(updateVaultKeyHashMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown code", async () => {
    getVaultMock.mockResolvedValue(null);
    await expect(authenticateVault({ vaultId: "ef".repeat(32), proof: PROOF })).resolves.toBeNull();
  });

  it("refuses to create a vault that already exists", async () => {
    getVaultMock.mockResolvedValue(createdVault());
    await expect(createNewVault({ ...AUTH, ...WRAP })).rejects.toBeInstanceOf(VaultExistsError);
    expect(createVaultMock).not.toHaveBeenCalled();
  });
});

describe("vault access keys", () => {
  beforeEach(() => {
    createVaultMock.mockReset();
    getVaultMock.mockReset();
    updateVaultKeyHashMock.mockReset();
    getAccessKeyByIdMock.mockReset();
    insertAccessKeyMock.mockReset();
    countActiveAccessKeysMock.mockReset();
    getVaultMock.mockResolvedValue(null);
    getAccessKeyByIdMock.mockResolvedValue(null);
    countActiveAccessKeysMock.mockReset();
    countActiveAccessKeysMock.mockResolvedValue(0);
    insertAccessKeyMock.mockImplementation(async (key) => key);
  });

  it("creates a hashed sub-key with scoped permissions, expiry, and wrapped DEK", async () => {
    const { accessKey } = await createVaultAccessKey("parent-vault", ["read", "download"], 30, {
      ...AUTH,
      ...WRAP,
    });

    expect(accessKey.permissions).toEqual(["read", "download"]);
    expect(accessKey.expiresAt).toBeTruthy();
    expect(new Date(accessKey.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    expect(insertAccessKeyMock).toHaveBeenCalledOnce();
    const stored = insertAccessKeyMock.mock.calls[0][0];
    expect(stored.vaultId).toBe("parent-vault");
    expect(stored.id).toBe(VAULT_ID);
    expect(stored.keyHash.startsWith("$argon2id$")).toBe(true);
    expect(stored.wrappedDek).toBe(WRAP.wrappedDek);
    expect(stored.permissions).toEqual(["read", "download"]);
  });

  it("authenticates a sub-key against the parent vault", async () => {
    const { accessKey } = await createVaultAccessKey("parent-vault", ["upload"], null, {
      ...AUTH,
      ...WRAP,
    });
    const stored = insertAccessKeyMock.mock.calls[0][0];
    getAccessKeyByIdMock.mockResolvedValue(stored);

    await expect(authenticateVault(AUTH)).resolves.toEqual({
      vaultId: "parent-vault",
      role: "sub",
      permissions: ["upload"],
      accessKeyId: accessKey.id,
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
    });
  });

  it("rejects an expired sub-key", async () => {
    getAccessKeyByIdMock.mockResolvedValue({
      id: VAULT_ID,
      vaultId: "parent-vault",
      keyHash: await hashVaultSecret(PROOF),
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
      permissions: ["read", "download"],
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      revokedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(authenticateVault(AUTH)).resolves.toBeNull();
  });

  it("rejects a revoked sub-key", async () => {
    getAccessKeyByIdMock.mockResolvedValue({
      id: VAULT_ID,
      vaultId: "parent-vault",
      keyHash: await hashVaultSecret(PROOF),
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
      permissions: ["read", "download"],
      expiresAt: null,
      revokedAt: new Date().toISOString(),
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(authenticateVault(AUTH)).resolves.toBeNull();
  });

  it("refuses to create more than the active key limit", async () => {
    countActiveAccessKeysMock.mockResolvedValue(MAX_ACTIVE_ACCESS_KEYS);
    await expect(
      createVaultAccessKey("parent-vault", ["upload"], 7, { ...AUTH, ...WRAP })
    ).rejects.toBeInstanceOf(AccessKeyLimitError);
    expect(insertAccessKeyMock).not.toHaveBeenCalled();
  });

  it("maps a known access key to its parent vault without authenticating", async () => {
    getAccessKeyByIdMock.mockResolvedValue({
      id: VAULT_ID,
      vaultId: "parent-vault",
      keyHash: "hash",
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
      permissions: ["read", "download"],
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      revokedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(findKnownVaultId(VAULT_ID)).resolves.toBe("parent-vault");
  });
});

describe("encrypted evidence metadata", () => {
  beforeEach(() => {
    createEvidenceMock.mockReset();
    createEvidenceMock.mockImplementation(async (item) => item);
  });

  const record: EvidenceRecord = {
    id: "item-1",
    vaultId: VAULT_ID,
    type: "file",
    size: 42,
    textContent: null,
    storagePath: `${VAULT_ID}/item-1`,
    contentNonce: "nonce",
    encryptedMeta: "packed-meta",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("exposes only type, size, and createdAt as plaintext on the wire", () => {
    const wire = toPublicEvidence(record);
    expect(wire).toEqual({
      id: "item-1",
      vaultId: VAULT_ID,
      type: "file",
      size: 42,
      contentNonce: "nonce",
      encryptedMeta: "packed-meta",
      encryptedContent: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(wire).not.toHaveProperty("name");
    expect(wire).not.toHaveProperty("mimeType");
    expect(JSON.stringify(wire)).not.toContain("secret.jpg");
  });

  it("stores file evidence without plaintext name or MIME type", async () => {
    const wire = await saveFileEvidence(VAULT_ID, Buffer.from("cipher"), "video", "nonce", "meta");
    const stored = createEvidenceMock.mock.calls[0][0];

    expect(stored).not.toHaveProperty("name");
    expect(stored).not.toHaveProperty("mimeType");
    expect(stored).toMatchObject({
      vaultId: VAULT_ID,
      type: "video",
      size: 6,
      encryptedMeta: "meta",
      contentNonce: "nonce",
    });
    expect(wire).not.toHaveProperty("name");
    expect(wire).not.toHaveProperty("mimeType");
    expect(wire.type).toBe("video");
    expect(wire.size).toBe(6);
    expect(wire.createdAt).toBeTruthy();
  });

  it("stores text evidence without plaintext name or MIME type", async () => {
    const wire = await saveTextEvidence(VAULT_ID, "cipher", "nonce", "meta", 12);
    const stored = createEvidenceMock.mock.calls[0][0];

    expect(stored).not.toHaveProperty("name");
    expect(stored).not.toHaveProperty("mimeType");
    expect(wire.encryptedContent).toBe("cipher");
    expect(wire.type).toBe("text");
    expect(wire.size).toBe(12);
  });
});
