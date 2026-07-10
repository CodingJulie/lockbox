import {
  encodeVaultAuthToken,
  base64urlToBytes,
  bytesToBase64url,
  sha256Hex,
  toArrayBufferBytes,
} from "@/lib/vault-key-codec";
import {
  deleteQueuedUpload,
  enqueueOfflineUpload,
  isLikelyNetworkError,
  listQueuedUploads,
} from "@/lib/offline-queue";
import {
  buildCourtManifest,
  buildHashList,
  sanitizeExportFilename,
  type CourtManifestItem,
} from "@/lib/court-export";
import { fetchTrustedTime } from "@/lib/trusted-time";
import { buildZipStore } from "@/lib/zip";
import type { AppLanguage } from "@/lib/detect-locale";
import type {
  EvidenceItem,
  EvidenceItemWire,
  VaultAccessKeyPublic,
  VaultActivitySummary,
  VaultAuthRole,
} from "@/lib/types";
import {
  MASTER_PERMISSIONS,
  parseSessionPermissions,
  type VaultPermission,
} from "@/lib/vault-permissions";
import { generateVaultKey } from "@/lib/vault-mnemonic";
import {
  decryptBytes,
  decryptMetadata,
  deriveVaultAuth,
  encryptBytes,
  encryptMetadata,
  generateDek,
  unwrapDek,
  wrapDek,
} from "@/lib/vault-crypto";

/** In-memory only — cleared on page leave (see SessionGuard) */
let vaultKeyMemory: string | null = null;
let vaultSessionMemory: VaultClientSession | null = null;
let vaultDekMemory: CryptoKey | null = null;
let vaultAuthMemory: { vaultId: string; proof: Uint8Array } | null = null;
let pendingVault: PendingVault | null = null;

interface PendingVault {
  key: string;
  dek: CryptoKey;
  vaultId: string;
  proof: Uint8Array;
}

export interface VaultClientSession {
  role: VaultAuthRole;
  permissions: VaultPermission[];
}

export function getStoredVaultKey(): string | null {
  return vaultKeyMemory;
}

export function getVaultSession(): VaultClientSession | null {
  return vaultSessionMemory;
}

export function storeVaultSession(session: VaultClientSession): void {
  vaultSessionMemory = session;
}

export function hasVaultPermission(permission: VaultPermission): boolean {
  return vaultSessionMemory?.permissions.includes(permission) ?? false;
}

function rememberCrypto(key: string, dek: CryptoKey, vaultId: string, proof: Uint8Array): void {
  vaultKeyMemory = key;
  vaultDekMemory = dek;
  vaultAuthMemory = { vaultId, proof };
}

export function storeVaultKey(key: string, session?: VaultClientSession): void {
  vaultKeyMemory = key;
  if (session) vaultSessionMemory = session;
  if (pendingVault?.key === key) {
    vaultDekMemory = pendingVault.dek;
    vaultAuthMemory = { vaultId: pendingVault.vaultId, proof: pendingVault.proof };
    pendingVault = null;
  }
}

export function storeMasterVaultKey(key: string): void {
  storeVaultKey(key, { role: "master", permissions: [...MASTER_PERMISSIONS] });
}

export function clearVaultKey(): void {
  vaultKeyMemory = null;
  vaultSessionMemory = null;
  vaultDekMemory = null;
  vaultAuthMemory = null;
  pendingVault = null;
}

function requireDek(): CryptoKey {
  if (!vaultDekMemory) {
    throw new Error("Vault encryption key is not available");
  }
  return vaultDekMemory;
}

export function authHeaders(): HeadersInit {
  const auth = vaultAuthMemory;
  return auth ? { Authorization: `Bearer ${encodeVaultAuthToken(auth.vaultId, auth.proof)}` } : {};
}

export class OfflineQueuedError extends Error {
  constructor() {
    super("Upload queued offline");
    this.name = "OfflineQueuedError";
  }
}

export type CreateVaultErrorReason = "rate_limited" | "failed";

export class CreateVaultError extends Error {
  readonly reason: CreateVaultErrorReason;

  constructor(reason: CreateVaultErrorReason, message: string) {
    super(message);
    this.name = "CreateVaultError";
    this.reason = reason;
  }
}

async function registerVault(
  locale: AppLanguage,
  attempt = 0
): Promise<{ key: string; dek: CryptoKey; vaultId: string; proof: Uint8Array }> {
  if (attempt >= 5) {
    throw new CreateVaultError("failed", "Vault creation failed");
  }
  const key = generateVaultKey(locale);
  const { vaultId, proof, kek, derivedKey } = await deriveVaultAuth(key);
  const dek = await generateDek();
  const wrap = await wrapDek(dek, kek);

  const res = await fetch("/api/vault", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vaultId,
      proof: bytesToBase64url(proof),
      wrappedDek: wrap.wrappedDek,
      dekNonce: wrap.dekNonce,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    derivedKey.fill(0);
    return registerVault(locale, attempt + 1);
  }
  if (!res.ok) {
    derivedKey.fill(0);
    throw new CreateVaultError(
      res.status === 429 ? "rate_limited" : "failed",
      data.error || "Vault creation failed"
    );
  }
  derivedKey.fill(0);
  return { key, dek, vaultId, proof };
}

export async function createVault(locale: AppLanguage = "ru"): Promise<{ key: string }> {
  const created = await registerVault(locale);
  pendingVault = created;
  return { key: created.key };
}

export type VerifyVaultKeyResult =
  | { ok: true; role: VaultAuthRole; permissions: VaultPermission[] }
  | { ok: false; reason: "invalid" | "rate_limited" };

export async function verifyVaultKey(key: string): Promise<VerifyVaultKeyResult> {
  const { vaultId, proof, kek, derivedKey } = await deriveVaultAuth(key);
  const res = await fetch("/api/vault/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultId, proof: bytesToBase64url(proof) }),
  });
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  if (!res.ok) return { ok: false, reason: "invalid" };

  const data = await res.json().catch(() => ({}));
  if (typeof data.wrappedDek !== "string" || typeof data.dekNonce !== "string") {
    return { ok: false, reason: "invalid" };
  }

  try {
    const extractable = data.role !== "sub";
    const dek = await unwrapDek(data.wrappedDek, data.dekNonce, kek, extractable);
    rememberCrypto(key, dek, vaultId, proof);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  derivedKey.fill(0);

  const permissions = parseSessionPermissions(data.permissions) ?? [...MASTER_PERMISSIONS];
  const role: VaultAuthRole = data.role === "sub" ? "sub" : "master";
  return { ok: true, role, permissions };
}

async function decryptWireItem(item: EvidenceItemWire, dek: CryptoKey): Promise<EvidenceItem> {
  let name = "";
  let mimeType: string | null = null;
  if (item.encryptedMeta) {
    try {
      const meta = await decryptMetadata(item.encryptedMeta, dek);
      name = meta.name;
      mimeType = meta.mimeType;
    } catch {
      name = "";
    }
  }

  let textContent: string | null = null;
  if (item.type === "text" && item.encryptedContent && item.contentNonce) {
    try {
      const plaintext = await decryptBytes(
        base64urlToBytes(item.encryptedContent),
        base64urlToBytes(item.contentNonce),
        dek
      );
      textContent = new TextDecoder().decode(plaintext);
    } catch {
      textContent = null;
    }
  }

  return {
    id: item.id,
    vaultId: item.vaultId,
    type: item.type,
    name,
    mimeType,
    size: item.size,
    textContent,
    storagePath: null,
    contentNonce: item.contentNonce,
    encryptedMeta: item.encryptedMeta,
    createdAt: item.createdAt,
  };
}

export async function fetchItems() {
  const res = await fetch("/api/vault/items", { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Load failed");
  }
  const data = (await res.json()) as { items: EvidenceItemWire[] };
  const dek = requireDek();
  const items = await Promise.all((data.items ?? []).map((item) => decryptWireItem(item, dek)));
  return { items };
}

async function encryptUpload(
  plaintext: Uint8Array,
  meta: { name: string; mimeType: string | null }
) {
  const dek = requireDek();
  const [{ nonce, ciphertext }, encryptedMeta] = await Promise.all([
    encryptBytes(plaintext, dek),
    encryptMetadata(meta, dek),
  ]);
  return { nonce, ciphertext, encryptedMeta };
}

async function postEncryptedFile(input: {
  ciphertext: Uint8Array;
  nonce: string;
  encryptedMeta: string;
  type?: string;
}) {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([toArrayBufferBytes(input.ciphertext)], { type: "application/octet-stream" }),
    "blob"
  );
  formData.append("nonce", input.nonce);
  formData.append("encryptedMeta", input.encryptedMeta);
  if (input.type) formData.append("type", input.type);

  const res = await fetch("/api/vault/upload", {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }
  return res.json();
}

export async function uploadFile(file: Blob, name: string, type?: string) {
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const { nonce, ciphertext, encryptedMeta } = await encryptUpload(plaintext, {
    name,
    mimeType: file.type || null,
  });
  const packed = {
    ciphertext,
    nonce: bytesToBase64url(nonce),
    encryptedMeta,
    type,
  };

  try {
    return await postEncryptedFile(packed);
  } catch (error) {
    if (!isLikelyNetworkError(error)) throw error;
    try {
      await enqueueOfflineUpload({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        nonce: packed.nonce,
        encryptedMeta,
        type,
        ciphertext: toArrayBufferBytes(ciphertext).buffer,
      });
    } catch {
      throw error;
    }
    throw new OfflineQueuedError();
  }
}

export async function flushOfflineQueue(): Promise<{ sent: number; failed: number }> {
  const headers = authHeaders();
  if (!("Authorization" in headers)) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const item of await listQueuedUploads()) {
    try {
      await postEncryptedFile({
        ciphertext: new Uint8Array(item.ciphertext),
        nonce: item.nonce,
        encryptedMeta: item.encryptedMeta,
        type: item.type,
      });
      await deleteQueuedUpload(item.id);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function saveText(text: string, name?: string) {
  const encoded = new TextEncoder().encode(text);
  const { nonce, ciphertext, encryptedMeta } = await encryptUpload(encoded, {
    name: name || `note-${Date.now()}`,
    mimeType: "text/plain",
  });

  const res = await fetch("/api/vault/text", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      ciphertext: bytesToBase64url(ciphertext),
      nonce: bytesToBase64url(nonce),
      encryptedMeta,
    }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Save failed");
  }
  return res.json();
}

export async function downloadItemBytes(
  item: Pick<EvidenceItem, "id" | "contentNonce">
): Promise<Uint8Array> {
  const res = await fetch(`/api/vault/download/${item.id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Download failed");
  if (!item.contentNonce) throw new Error("Download failed");

  const ciphertext = new Uint8Array(await res.arrayBuffer());
  return decryptBytes(ciphertext, base64urlToBytes(item.contentNonce), requireDek());
}

export async function downloadItem(
  item: Pick<EvidenceItem, "id" | "name" | "mimeType" | "contentNonce">
) {
  const plaintext = await downloadItemBytes(item);
  const blob = new Blob([toArrayBufferBytes(plaintext)], {
    type: item.mimeType || "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = item.name || `${item.id}.bin`;
  a.click();
  URL.revokeObjectURL(url);
}

async function readItemPlaintext(item: EvidenceItem): Promise<Uint8Array> {
  if (item.type === "text" && item.textContent != null) {
    return new TextEncoder().encode(item.textContent);
  }
  return downloadItemBytes(item);
}

export async function exportCourtPackage(): Promise<void> {
  const { items } = await fetchItems();
  const time = await fetchTrustedTime();
  const files: { name: string; data: Uint8Array }[] = [];
  const manifestItems: CourtManifestItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const bytes = await readItemPlaintext(item);
    const path = `files/${sanitizeExportFilename(item.name || item.type, i)}`;
    manifestItems.push({
      id: item.id,
      path,
      type: item.type,
      size: bytes.byteLength,
      createdAt: item.createdAt,
      sha256: await sha256Hex(bytes),
    });
    files.push({ name: path, data: bytes });
  }

  const manifest = buildCourtManifest(manifestItems, time);
  files.unshift({
    name: "manifest.json",
    data: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
  });
  files.push({
    name: "hashes.sha256",
    data: new TextEncoder().encode(buildHashList(manifestItems)),
  });

  const zip = buildZipStore(files, new Date(time.iso));
  const blob = new Blob([toArrayBufferBytes(zip)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lockbox-export-${time.unix}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchAccessKeys(): Promise<{ keys: VaultAccessKeyPublic[] }> {
  const res = await fetch("/api/vault/keys", { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Load failed");
  }
  return res.json();
}

export async function createAccessKey(input: {
  permissions: VaultPermission[];
  expiresInDays: number | null;
  locale?: AppLanguage;
}): Promise<{ key: string; accessKey: VaultAccessKeyPublic }> {
  const dek = requireDek();
  const locale = input.locale ?? "ru";

  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateVaultKey(locale);
    const { vaultId, proof, kek, derivedKey } = await deriveVaultAuth(key);
    const wrap = await wrapDek(dek, kek);

    const res = await fetch("/api/vault/keys", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: input.permissions,
        expiresInDays: input.expiresInDays,
        vaultId,
        proof: bytesToBase64url(proof),
        wrappedDek: wrap.wrappedDek,
        dekNonce: wrap.dekNonce,
      }),
    });
    derivedKey.fill(0);
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) continue;
    if (!res.ok) {
      throw new Error(data.error || "Create failed");
    }
    return { key, accessKey: data.accessKey };
  }

  throw new Error("Create failed");
}

export async function revokeAccessKey(id: string): Promise<void> {
  const res = await fetch(`/api/vault/keys/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Revoke failed");
  }
}

export async function fetchActivity(): Promise<VaultActivitySummary> {
  const res = await fetch("/api/vault/activity", { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Load failed");
  }
  return res.json();
}
