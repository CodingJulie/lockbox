import { normalizeVaultKey } from "@/lib/vault-mnemonic";
import {
  AUTH_SECRET_BYTES,
  GCM_NONCE_BYTES,
  base64urlToBytes,
  bytesToBase64url,
  bytesToHex,
  toArrayBufferBytes,
} from "@/lib/vault-key-codec";

const HKDF_SALT = new TextEncoder().encode("lockbox-hkdf-v1");
const INFO_AUTH = new TextEncoder().encode("lockbox-auth-v1");
const INFO_KEK = new TextEncoder().encode("lockbox-kek-v1");

export interface EncryptedPayload {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EvidenceMeta {
  name: string;
  mimeType: string | null;
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle;
  if (!api) {
    throw new Error("Web Crypto API is not available");
  }
  return api;
}

async function importHkdfIkm(mnemonic: string): Promise<CryptoKey> {
  return subtle().importKey(
    "raw",
    new TextEncoder().encode(normalizeVaultKey(mnemonic)),
    "HKDF",
    false,
    ["deriveBits", "deriveKey"]
  );
}

/** 32-byte HMAC key derived from the mnemonic. Never sent to the server. */
export async function deriveAuthKey(mnemonic: string): Promise<Uint8Array> {
  const ikm = await importHkdfIkm(mnemonic);
  return new Uint8Array(
    await subtle().deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: INFO_AUTH },
      ikm,
      AUTH_SECRET_BYTES * 8
    )
  );
}

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest("SHA-256", toArrayBufferBytes(data)));
}

async function hmacSha256(keyBytes: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const key = await subtle().importKey(
    "raw",
    toArrayBufferBytes(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await subtle().sign("HMAC", key, toArrayBufferBytes(message)));
}

/** AES-256-GCM key that wraps the vault DEK. Never leaves the client. */
export async function deriveKek(mnemonic: string): Promise<CryptoKey> {
  const ikm = await importHkdfIkm(mnemonic);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: INFO_KEK },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Addressing id + HMAC proof from the mnemonic.
 * `derivedKey` stays on the client; only `vaultId` and `proof` are sent.
 */
export async function deriveVaultAuth(mnemonic: string): Promise<{
  derivedKey: Uint8Array;
  vaultId: string;
  proof: Uint8Array;
  kek: CryptoKey;
}> {
  const [derivedKey, kek] = await Promise.all([deriveAuthKey(mnemonic), deriveKek(mnemonic)]);
  const vaultId = bytesToHex(await sha256Bytes(derivedKey));
  const proof = await hmacSha256(derivedKey, new TextEncoder().encode(vaultId));
  return { derivedKey, vaultId, proof, kek };
}

export async function generateDek(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function encryptBytes(
  plaintext: Uint8Array,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const nonce = crypto.getRandomValues(new Uint8Array(GCM_NONCE_BYTES));
  const ciphertext = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv: nonce }, key, toArrayBufferBytes(plaintext))
  );
  return { nonce, ciphertext };
}

export async function decryptBytes(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: CryptoKey
): Promise<Uint8Array> {
  return new Uint8Array(
    await subtle().decrypt(
      { name: "AES-GCM", iv: toArrayBufferBytes(nonce) },
      key,
      toArrayBufferBytes(ciphertext)
    )
  );
}

export async function wrapDek(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<{ wrappedDek: string; dekNonce: string }> {
  const raw = new Uint8Array(await subtle().exportKey("raw", dek));
  const { nonce, ciphertext } = await encryptBytes(raw, kek);
  return {
    wrappedDek: bytesToBase64url(ciphertext),
    dekNonce: bytesToBase64url(nonce),
  };
}

export async function unwrapDek(
  wrappedDek: string,
  dekNonce: string,
  kek: CryptoKey,
  extractable = false
): Promise<CryptoKey> {
  const raw = await decryptBytes(base64urlToBytes(wrappedDek), base64urlToBytes(dekNonce), kek);
  return subtle().importKey(
    "raw",
    toArrayBufferBytes(raw),
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMetadata(meta: EvidenceMeta, dek: CryptoKey): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(meta));
  const { nonce, ciphertext } = await encryptBytes(encoded, dek);
  const packed = new Uint8Array(nonce.length + ciphertext.length);
  packed.set(nonce, 0);
  packed.set(ciphertext, nonce.length);
  return bytesToBase64url(packed);
}

export async function decryptMetadata(packed: string, dek: CryptoKey): Promise<EvidenceMeta> {
  const bytes = base64urlToBytes(packed);
  const nonce = bytes.slice(0, GCM_NONCE_BYTES);
  const ciphertext = bytes.slice(GCM_NONCE_BYTES);
  const parsed = JSON.parse(
    new TextDecoder().decode(await decryptBytes(ciphertext, nonce, dek))
  ) as {
    name?: unknown;
    mimeType?: unknown;
  };
  return {
    name: typeof parsed.name === "string" && parsed.name ? parsed.name : "item",
    mimeType: typeof parsed.mimeType === "string" ? parsed.mimeType : null,
  };
}
