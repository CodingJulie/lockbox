// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import {
  hashVaultSecret,
  resetVaultSecretCacheForTests,
  vaultSecretNeedsRehash,
  verifyVaultSecret,
} from "@/lib/vault-secret";

describe("vault Argon2id secret", () => {
  afterEach(() => {
    process.env.VAULT_HASH_PEPPER = "test-pepper-not-for-production";
    resetVaultSecretCacheForTests();
  });

  it("hashes and verifies with the server pepper", async () => {
    const key = "quiet-light-bridge-shore-a1b2c3d4";
    const hashed = await hashVaultSecret(key);

    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(await verifyVaultSecret(key, hashed)).toBe(true);
    expect(await verifyVaultSecret("wrong-key", hashed)).toBe(false);
    expect(vaultSecretNeedsRehash(hashed)).toBe(false);
  });

  it("rejects a hash when the pepper changes", async () => {
    const key = "quiet-light-bridge-shore-a1b2c3d4";
    const hashed = await hashVaultSecret(key);

    process.env.VAULT_HASH_PEPPER = "another-pepper-value!!";
    resetVaultSecretCacheForTests();

    expect(await verifyVaultSecret(key, hashed)).toBe(false);
  });

  it("treats a missing stored hash as a failed dummy verify", async () => {
    expect(await verifyVaultSecret("quiet-light-bridge-shore-a1b2c3d4", null)).toBe(false);
  });

  it("refuses to hash without a pepper", async () => {
    const original = process.env.VAULT_HASH_PEPPER;
    delete process.env.VAULT_HASH_PEPPER;
    resetVaultSecretCacheForTests();
    try {
      await expect(hashVaultSecret("quiet-light-bridge-shore-a1b2c3d4")).rejects.toThrow(
        /VAULT_HASH_PEPPER/
      );
    } finally {
      process.env.VAULT_HASH_PEPPER = original;
      resetVaultSecretCacheForTests();
    }
  });
});
