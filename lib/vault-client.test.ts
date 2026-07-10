import { describe, it, expect, beforeEach } from "vitest";
import { storeVaultKey, getStoredVaultKey, clearVaultKey } from "@/lib/vault-client";

describe("vault-client session", () => {
  beforeEach(() => clearVaultKey());

  it("stores key in memory only", () => {
    storeVaultKey("test-key");
    expect(getStoredVaultKey()).toBe("test-key");
  });

  it("clears key on logout", () => {
    storeVaultKey("test-key");
    clearVaultKey();
    expect(getStoredVaultKey()).toBeNull();
  });
});
