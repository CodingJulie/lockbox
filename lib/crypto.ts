import { generateVaultKey, normalizeVaultKey } from "@/lib/vault-mnemonic";
import {
  GCM_NONCE_BYTES,
  HMAC_PROOF_BYTES,
  VAULT_ID_HEX_RE,
  WRAPPED_DEK_BYTES,
} from "@/lib/vault-key-codec";

export { generateVaultKey, normalizeVaultKey };

export interface VaultAuthMaterial {
  vaultId: string;
  proof: string;
}

function decodeExactBase64url(value: string, expectedBytes: number): Buffer | null {
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length !== expectedBytes) return null;
    return bytes;
  } catch {
    return null;
  }
}

export function parseVaultId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const vaultId = value.toLowerCase();
  return VAULT_ID_HEX_RE.test(vaultId) ? vaultId : null;
}

export function parseVaultProof(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const bytes = decodeExactBase64url(value, HMAC_PROOF_BYTES);
  return bytes ? bytes.toString("hex") : null;
}

export function parseVaultAuthPayload(body: {
  vaultId?: unknown;
  proof?: unknown;
}): VaultAuthMaterial | null {
  const vaultId = parseVaultId(body.vaultId);
  const proof = parseVaultProof(body.proof);
  if (!vaultId || !proof) return null;
  return { vaultId, proof };
}

/** Decode `Authorization: Bearer <vaultId>.<proof>` — HMAC proof, not the vault code. */
export function extractVaultAuth(authHeader: string | null): VaultAuthMaterial | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const separator = token.indexOf(".");
  if (separator <= 0) return null;
  const vaultId = parseVaultId(token.slice(0, separator));
  const proof = parseVaultProof(token.slice(separator + 1));
  if (!vaultId || !proof) return null;
  return { vaultId, proof };
}

export function parseDekWrap(
  wrappedDek: unknown,
  dekNonce: unknown
): { wrappedDek: string; dekNonce: string } | null {
  if (typeof wrappedDek !== "string" || typeof dekNonce !== "string") return null;
  const nonce = decodeExactBase64url(dekNonce, GCM_NONCE_BYTES);
  const wrapped = decodeExactBase64url(wrappedDek, WRAPPED_DEK_BYTES);
  if (!nonce || !wrapped) return null;
  return { wrappedDek, dekNonce };
}

export function parseContentNonce(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return decodeExactBase64url(value, GCM_NONCE_BYTES) ? value : null;
}

export function parseEncryptedMeta(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < GCM_NONCE_BYTES + 16) return null;
    return value;
  } catch {
    return null;
  }
}
