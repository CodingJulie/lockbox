import { describe, it, expect } from "vitest";
import { encodeVaultKeyForTransport } from "@/lib/vault-key-codec";
import { decodeVaultKeyFromTransport } from "@/lib/crypto";

describe("vault key transport encoding", () => {
  it("roundtrips Cyrillic keys", () => {
    const key = "тихий-свет-мост-A1B2";
    const encoded = encodeVaultKeyForTransport(key);
    expect(encoded).not.toContain("тихий");
    expect(decodeVaultKeyFromTransport(encoded)).toBe(key.toLowerCase());
  });

  it("roundtrips ASCII keys", () => {
    const key = "quiet-light-bridge-A1B2";
    const encoded = encodeVaultKeyForTransport(key);
    expect(decodeVaultKeyFromTransport(encoded)).toBe(key.toLowerCase());
  });
});
