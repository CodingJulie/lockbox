import { describe, expect, it } from "vitest";
import { extractVaultAuth } from "@/lib/crypto";
import { encodeVaultAuthToken, HMAC_PROOF_BYTES, VAULT_ID_HEX_RE } from "@/lib/vault-key-codec";

describe("vault auth token encoding", () => {
  it("roundtrips vault id and HMAC proof", () => {
    const vaultId = "ab".repeat(32);
    const proof = new Uint8Array(HMAC_PROOF_BYTES);
    for (let i = 0; i < proof.length; i++) proof[i] = (i * 7 + 3) % 256;
    const encoded = encodeVaultAuthToken(vaultId, proof);
    expect(encoded).toContain(".");
    expect(encoded).not.toMatch(/[+/=]/);
    expect(VAULT_ID_HEX_RE.test(vaultId)).toBe(true);
    expect(extractVaultAuth(`Bearer ${encoded}`)).toEqual({
      vaultId,
      proof: Array.from(proof, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    });
  });

  it("rejects a mnemonic sent as a bearer token", () => {
    expect(extractVaultAuth("Bearer quiet-light-bridge-shore-A1B2")).toBeNull();
  });
});
