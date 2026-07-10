import type { VaultPermission } from "@/lib/vault-permissions";

export type EvidenceType = "file" | "audio" | "video" | "text";

/** Persisted row. Plaintext is type, size, createdAt only — name and MIME live in encryptedMeta. */
export interface EvidenceRecord {
  id: string;
  vaultId: string;
  type: EvidenceType;
  size: number | null;
  textContent: string | null;
  storagePath: string | null;
  contentNonce: string | null;
  encryptedMeta: string | null;
  createdAt: string;
}

/** Client view after decrypting metadata (and text). */
export interface EvidenceItem extends EvidenceRecord {
  name: string;
  mimeType: string | null;
}

/** Wire format: ciphertext + nonce + encrypted metadata. No plaintext name or MIME. */
export interface EvidenceItemWire {
  id: string;
  vaultId: string;
  type: EvidenceType;
  size: number | null;
  contentNonce: string | null;
  encryptedMeta: string | null;
  encryptedContent: string | null;
  createdAt: string;
}

export interface Vault {
  id: string;
  keyHash: string | null;
  wrappedDek: string | null;
  dekNonce: string | null;
  createdAt: string;
}

export interface VaultSession {
  key: string;
  vaultId: string;
}

export type VaultAuthRole = "master" | "sub";

export interface VaultAuth {
  vaultId: string;
  role: VaultAuthRole;
  permissions: VaultPermission[];
  accessKeyId?: string;
  wrappedDek: string | null;
  dekNonce: string | null;
}

export interface VaultAccessKey {
  id: string;
  vaultId: string;
  keyHash: string;
  wrappedDek: string | null;
  dekNonce: string | null;
  permissions: VaultPermission[];
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface VaultAccessKeyPublic {
  id: string;
  permissions: VaultPermission[];
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export const VAULT_EVENT_ACTIONS = ["login", "upload", "download", "verify_fail"] as const;
export type VaultEventAction = (typeof VAULT_EVENT_ACTIONS)[number];

export interface VaultEvent {
  id: string;
  vaultId: string;
  action: VaultEventAction;
  ipHash: string;
  createdAt: string;
}

export interface VaultActivitySummary {
  lastLoginAt: string | null;
  downloads: number;
  uploads: number;
  failedVerifies: number;
}
