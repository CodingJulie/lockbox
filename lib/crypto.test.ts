import { describe, expect, it } from "vitest";
import { generateVaultKey, extractVaultAuth, parseVaultAuthPayload } from "@/lib/crypto";
import { encodeVaultAuthToken, HMAC_PROOF_BYTES } from "@/lib/vault-key-codec";

const KEY_PATTERN = /^[\p{L}]+(?:-[\p{L}]+){3}-[A-F0-9]{8}$/u;
const VAULT_ID = "ab".repeat(32);

describe("generateVaultKey", () => {
  it("generates Russian word codes by default", () => {
    const key = generateVaultKey();
    expect(key).toMatch(KEY_PATTERN);
    expect(key).toMatch(/[а-яё]/i);
  });

  it("generates English word codes when locale is en", () => {
    const key = generateVaultKey("en");
    expect(key).toMatch(KEY_PATTERN);
    expect(key).not.toMatch(/[а-яё]/i);
    expect(key).toMatch(/^[a-z]+(?:-[a-z]+){3}-[A-F0-9]{8}$/);
  });
});

describe("vault HMAC proof transport", () => {
  it("parses Bearer vaultId.proof and rejects a mnemonic", () => {
    const proof = new Uint8Array(HMAC_PROOF_BYTES);
    proof.fill(9);
    const token = encodeVaultAuthToken(VAULT_ID, proof);

    expect(extractVaultAuth(`Bearer ${token}`)).toEqual({
      vaultId: VAULT_ID,
      proof: Buffer.from(proof).toString("hex"),
    });
    expect(extractVaultAuth("Bearer quiet-light-bridge-shore-A1B2")).toBeNull();
  });

  it("parses a JSON auth payload", () => {
    const proof = Buffer.alloc(32, 3).toString("base64url");
    expect(parseVaultAuthPayload({ vaultId: VAULT_ID, proof })).toEqual({
      vaultId: VAULT_ID,
      proof: Buffer.alloc(32, 3).toString("hex"),
    });
    expect(parseVaultAuthPayload({ vaultId: VAULT_ID, proof: "nope" })).toBeNull();
  });
});
