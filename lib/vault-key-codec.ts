export const AUTH_SECRET_BYTES = 32;
export const HMAC_PROOF_BYTES = 32;
export const GCM_NONCE_BYTES = 12;
export const GCM_TAG_BYTES = 16;
export const WRAPPED_DEK_BYTES = AUTH_SECRET_BYTES + GCM_TAG_BYTES;
export const VAULT_ID_HEX_RE = /^[a-f0-9]{64}$/;

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(token: string): Uint8Array {
  const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", toArrayBufferBytes(data));
  return bytesToHex(new Uint8Array(hash));
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.toLowerCase();
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function encodeBytesForTransport(bytes: Uint8Array): string {
  return bytesToBase64url(bytes);
}

/** Bearer token: `<vaultId>.<proof>` — proof is HMAC, not the vault code or derived key. */
export function encodeVaultAuthToken(vaultId: string, proof: Uint8Array): string {
  return `${vaultId}.${bytesToBase64url(proof)}`;
}

export function decodeVaultAuthToken(token: string): { vaultId: string; proof: Uint8Array } | null {
  const separator = token.indexOf(".");
  if (separator <= 0) return null;
  const vaultId = token.slice(0, separator).toLowerCase();
  const proofPart = token.slice(separator + 1);
  if (!VAULT_ID_HEX_RE.test(vaultId) || !proofPart) return null;
  const proof = base64urlToBytes(proofPart);
  if (proof.length !== HMAC_PROOF_BYTES) return null;
  return { vaultId, proof };
}

/** Copy into a standalone ArrayBuffer so Web Crypto / Blob accept the view. */
export function toArrayBufferBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}
