import { randomUUID } from "crypto";
import {
  createVault,
  getVault,
  listEvidence,
  getEvidence,
  createEvidence,
  updateVaultKeyHash,
  insertAccessKey,
  getAccessKeyById,
  listAccessKeysByVault,
  countActiveAccessKeys,
  revokeAccessKey,
  updateAccessKeyHash,
} from "@/lib/db";
import { hashVaultSecret, verifyVaultSecret, vaultSecretNeedsRehash } from "@/lib/vault-secret";
import { logServerError } from "@/lib/safe-log";
import { uploadFile, downloadFile } from "@/lib/storage";
import type {
  EvidenceRecord,
  EvidenceItemWire,
  EvidenceType,
  VaultAccessKey,
  VaultAccessKeyPublic,
  VaultAuth,
} from "@/lib/types";
import {
  MASTER_PERMISSIONS,
  MAX_ACTIVE_ACCESS_KEYS,
  isAccessKeyUsable,
  type SubKeyPermission,
} from "@/lib/vault-permissions";

export class AccessKeyLimitError extends Error {
  constructor() {
    super("ACCESS_KEY_LIMIT");
    this.name = "AccessKeyLimitError";
  }
}

export class AccessKeyConflictError extends Error {
  constructor() {
    super("ACCESS_KEY_CONFLICT");
    this.name = "AccessKeyConflictError";
  }
}

export class VaultExistsError extends Error {
  constructor() {
    super("VAULT_EXISTS");
    this.name = "VaultExistsError";
  }
}

function toPublicAccessKey(key: VaultAccessKey): VaultAccessKeyPublic {
  return {
    id: key.id,
    permissions: key.permissions,
    expiresAt: key.expiresAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
  };
}

export function toPublicEvidence(item: EvidenceRecord): EvidenceItemWire {
  return {
    id: item.id,
    vaultId: item.vaultId,
    type: item.type,
    size: item.size,
    contentNonce: item.contentNonce,
    encryptedMeta: item.encryptedMeta,
    encryptedContent: item.type === "text" ? item.textContent : null,
    createdAt: item.createdAt,
  };
}

async function rehashIfNeeded(storedHash: string, update: () => Promise<void>): Promise<void> {
  if (!vaultSecretNeedsRehash(storedHash)) return;
  try {
    await update();
  } catch (error) {
    logServerError("Vault key rehash failed:", error);
  }
}

export async function createNewVault(input: {
  vaultId: string;
  proof: string;
  wrappedDek: string;
  dekNonce: string;
}): Promise<{ vaultId: string }> {
  const existing = await getVault(input.vaultId);
  if (existing) throw new VaultExistsError();

  const keyHash = await hashVaultSecret(input.proof);
  await createVault(input.vaultId, keyHash, {
    wrappedDek: input.wrappedDek,
    dekNonce: input.dekNonce,
  });
  return { vaultId: input.vaultId };
}

export async function authenticateVault(auth: {
  vaultId: string;
  proof: string;
}): Promise<VaultAuth | null> {
  const [vault, accessKey] = await Promise.all([
    getVault(auth.vaultId),
    getAccessKeyById(auth.vaultId),
  ]);

  if (vault) {
    if (!vault.keyHash) {
      await verifyVaultSecret(auth.proof, null);
      return null;
    }
    const ok = await verifyVaultSecret(auth.proof, vault.keyHash);
    if (!ok) return null;
    await rehashIfNeeded(vault.keyHash, async () => {
      await updateVaultKeyHash(vault.id, await hashVaultSecret(auth.proof));
    });
    return {
      vaultId: vault.id,
      role: "master",
      permissions: [...MASTER_PERMISSIONS],
      wrappedDek: vault.wrappedDek,
      dekNonce: vault.dekNonce,
    };
  }

  if (accessKey) {
    const ok = await verifyVaultSecret(auth.proof, accessKey.keyHash);
    if (!ok) return null;
    if (!isAccessKeyUsable(accessKey)) return null;
    await rehashIfNeeded(accessKey.keyHash, async () => {
      await updateAccessKeyHash(accessKey.id, await hashVaultSecret(auth.proof));
    });
    return {
      vaultId: accessKey.vaultId,
      role: "sub",
      permissions: accessKey.permissions,
      accessKeyId: accessKey.id,
      wrappedDek: accessKey.wrappedDek,
      dekNonce: accessKey.dekNonce,
    };
  }

  await verifyVaultSecret(auth.proof, null);
  return null;
}

export async function findKnownVaultId(vaultId: string): Promise<string | null> {
  const [vault, accessKey] = await Promise.all([getVault(vaultId), getAccessKeyById(vaultId)]);
  return vault?.id ?? accessKey?.vaultId ?? null;
}

export async function createVaultAccessKey(
  vaultId: string,
  permissions: SubKeyPermission[],
  expiresInDays: number | null,
  input: { vaultId: string; proof: string; wrappedDek: string; dekNonce: string }
): Promise<{ accessKey: VaultAccessKeyPublic }> {
  const active = await countActiveAccessKeys(vaultId);
  if (active >= MAX_ACTIVE_ACCESS_KEYS) {
    throw new AccessKeyLimitError();
  }

  const id = input.vaultId;
  const [existingVault, existingKey] = await Promise.all([getVault(id), getAccessKeyById(id)]);
  if (existingVault || existingKey) {
    throw new AccessKeyConflictError();
  }

  const expiresAt =
    expiresInDays === null
      ? null
      : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const record: VaultAccessKey = {
    id,
    vaultId,
    keyHash: await hashVaultSecret(input.proof),
    wrappedDek: input.wrappedDek,
    dekNonce: input.dekNonce,
    permissions: [...permissions],
    expiresAt,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };
  await insertAccessKey(record);
  return { accessKey: toPublicAccessKey(record) };
}

export async function listVaultAccessKeys(vaultId: string): Promise<VaultAccessKeyPublic[]> {
  const keys = await listAccessKeysByVault(vaultId);
  return keys.map(toPublicAccessKey);
}

export async function revokeVaultAccessKey(vaultId: string, accessKeyId: string): Promise<boolean> {
  return revokeAccessKey(accessKeyId, vaultId);
}

export async function getVaultItems(vaultId: string): Promise<EvidenceItemWire[]> {
  const items = await listEvidence(vaultId);
  return items.map(toPublicEvidence);
}

export async function saveTextEvidence(
  vaultId: string,
  encryptedContent: string,
  contentNonce: string,
  encryptedMeta: string,
  size: number
): Promise<EvidenceItemWire> {
  const item: EvidenceRecord = {
    id: randomUUID(),
    vaultId,
    type: "text",
    size,
    textContent: encryptedContent,
    storagePath: null,
    contentNonce,
    encryptedMeta,
    createdAt: new Date().toISOString(),
  };
  return toPublicEvidence(await createEvidence(item));
}

export async function saveFileEvidence(
  vaultId: string,
  ciphertext: Buffer,
  type: EvidenceType,
  contentNonce: string,
  encryptedMeta: string
): Promise<EvidenceItemWire> {
  const id = randomUUID();
  const storagePath = `${vaultId}/${id}`;
  await uploadFile(storagePath, ciphertext, "application/octet-stream");

  const item: EvidenceRecord = {
    id,
    vaultId,
    type,
    size: ciphertext.length,
    textContent: null,
    storagePath,
    contentNonce,
    encryptedMeta,
    createdAt: new Date().toISOString(),
  };
  return toPublicEvidence(await createEvidence(item));
}

export async function getEvidenceFile(
  vaultId: string,
  evidenceId: string
): Promise<{ item: EvidenceItemWire; data: Buffer } | null> {
  const item = await getEvidence(evidenceId, vaultId);
  if (!item) return null;

  if (item.type === "text" && item.textContent) {
    return {
      item: toPublicEvidence(item),
      data: Buffer.from(item.textContent, "base64url"),
    };
  }

  if (!item.storagePath) return null;
  const data = await downloadFile(item.storagePath);
  return { item: toPublicEvidence(item), data };
}
