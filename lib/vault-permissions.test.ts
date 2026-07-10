import { describe, expect, it } from "vitest";
import {
  parseExpiresInDays,
  parseSessionPermissions,
  parseSubKeyPermissions,
  isAccessKeyUsable,
  DEFAULT_ACCESS_KEY_EXPIRY_DAYS,
} from "@/lib/vault-permissions";

describe("vault permissions", () => {
  it("parses sub-key permissions and strips manage", () => {
    expect(parseSubKeyPermissions(["read", "download", "manage"])).toEqual(["read", "download"]);
    expect(parseSubKeyPermissions([])).toBeNull();
    expect(parseSubKeyPermissions(["manage"])).toBeNull();
  });

  it("parses session permissions including manage", () => {
    expect(parseSessionPermissions(["read", "manage"])).toEqual(["read", "manage"]);
  });

  it("defaults expiry to 30 days and accepts 7/30/90/null", () => {
    expect(parseExpiresInDays(undefined)).toBe(DEFAULT_ACCESS_KEY_EXPIRY_DAYS);
    expect(parseExpiresInDays(null)).toBeNull();
    expect(parseExpiresInDays(7)).toBe(7);
    expect(parseExpiresInDays(14)).toBeUndefined();
  });

  it("treats revoked and expired keys as unusable", () => {
    expect(
      isAccessKeyUsable({ revokedAt: null, expiresAt: new Date(Date.now() + 60_000).toISOString() })
    ).toBe(true);
    expect(isAccessKeyUsable({ revokedAt: new Date().toISOString(), expiresAt: null })).toBe(false);
    expect(
      isAccessKeyUsable({ revokedAt: null, expiresAt: new Date(Date.now() - 1000).toISOString() })
    ).toBe(false);
  });
});
