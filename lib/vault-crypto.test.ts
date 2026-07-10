import { describe, expect, it } from "vitest";
import {
  decryptBytes,
  decryptMetadata,
  deriveAuthKey,
  deriveKek,
  deriveVaultAuth,
  encryptBytes,
  encryptMetadata,
  generateDek,
  unwrapDek,
  wrapDek,
} from "@/lib/vault-crypto";
import { generateVaultKey } from "@/lib/vault-mnemonic";
import { bytesToBase64url } from "@/lib/vault-key-codec";

describe("vault-crypto", () => {
  it("encrypts and decrypts bytes with AES-256-GCM", async () => {
    const dek = await generateDek();
    const plaintext = new TextEncoder().encode("secret evidence");
    const { nonce, ciphertext } = await encryptBytes(plaintext, dek);
    expect(ciphertext).not.toEqual(plaintext);
    const decrypted = await decryptBytes(ciphertext, nonce, dek);
    expect(new TextDecoder().decode(decrypted)).toBe("secret evidence");
  });

  it("wraps a DEK so the mnemonic is required to unwrap it", async () => {
    const mnemonic = generateVaultKey("en");
    const kek = await deriveKek(mnemonic);
    const dek = await generateDek();
    const wrap = await wrapDek(dek, kek);

    const restored = await unwrapDek(wrap.wrappedDek, wrap.dekNonce, kek, true);
    const payload = new TextEncoder().encode("hello");
    const encrypted = await encryptBytes(payload, dek);
    const decrypted = await decryptBytes(encrypted.ciphertext, encrypted.nonce, restored);
    expect(new TextDecoder().decode(decrypted)).toBe("hello");

    const otherKek = await deriveKek(generateVaultKey("en"));
    await expect(unwrapDek(wrap.wrappedDek, wrap.dekNonce, otherKek)).rejects.toThrow();
  });

  it("derives a stable HMAC proof without exposing the derived key", async () => {
    const mnemonic = "quiet-light-bridge-shore-A1B2C3D4";
    const [a, b] = await Promise.all([deriveVaultAuth(mnemonic), deriveVaultAuth(mnemonic)]);
    expect(a.vaultId).toBe(b.vaultId);
    expect(Array.from(a.proof)).toEqual(Array.from(b.proof));
    expect(a.proof.length).toBe(32);
    expect(a.vaultId).toMatch(/^[a-f0-9]{64}$/);
    expect(bytesToBase64url(a.proof)).not.toBe(bytesToBase64url(a.derivedKey));
    const key = await deriveAuthKey(mnemonic);
    expect(Array.from(key)).toEqual(Array.from(a.derivedKey));
  });

  it("encrypts metadata independently of file ciphertext", async () => {
    const dek = await generateDek();
    const packed = await encryptMetadata({ name: "photo.jpg", mimeType: "image/jpeg" }, dek);
    expect(packed).not.toContain("photo.jpg");
    expect(packed).not.toContain("image/jpeg");
    await expect(decryptMetadata(packed, dek)).resolves.toEqual({
      name: "photo.jpg",
      mimeType: "image/jpeg",
    });
  });
});
