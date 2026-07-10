import { describe, expect, it } from "vitest";
import {
  combineSecret,
  combineVaultKeyShares,
  looksLikeVaultShare,
  ShareError,
  splitSecret,
  splitVaultKey,
} from "@/lib/shamir";

describe("splitSecret / combineSecret", () => {
  it("reconstructs a secret from both 2-of-2 shares", () => {
    const secret = new TextEncoder().encode("quiet-light-bridge-shore-A1B2C3D4");
    const shares = splitSecret(secret);
    expect(shares).toHaveLength(2);
    expect(Array.from(combineSecret(shares))).toEqual(Array.from(secret));
    expect(Array.from(combineSecret([...shares].reverse()))).toEqual(Array.from(secret));
  });

  it("does not put the secret in either share", () => {
    const secret = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const shares = splitSecret(secret);
    expect(shares[0].y).not.toEqual(secret);
    expect(shares[1].y).not.toEqual(secret);
    expect(shares[0].y).not.toEqual(shares[1].y);
  });

  it("rejects a single share", () => {
    const shares = splitSecret(Uint8Array.from([9, 8, 7]));
    expect(() => combineSecret([shares[0]])).toThrow(ShareError);
  });

  it("uses a deterministic polynomial when RNG is fixed", () => {
    const secret = Uint8Array.from([0x01]);
    let calls = 0;
    const random = () => {
      calls += 1;
      return Uint8Array.from([0x03]);
    };
    const shares = splitSecret(secret, 2, 2, random);
    expect(calls).toBe(1);
    expect(shares[0]).toEqual({ x: 1, y: Uint8Array.from([0x02]) });
    expect(shares[1]).toEqual({ x: 2, y: Uint8Array.from([0x07]) });
    expect(combineSecret(shares)).toEqual(secret);
  });
});

describe("vault key shares", () => {
  it("roundtrips Russian and English vault keys", () => {
    for (const key of ["тихий-свет-мост-берег-A1B2C3D4", "quiet-light-bridge-shore-A1B2C3D4"]) {
      const [a, b] = splitVaultKey(key);
      expect(a).toMatch(/^lb2\.1\./);
      expect(b).toMatch(/^lb2\.2\./);
      expect(looksLikeVaultShare(a)).toBe(true);
      expect(combineVaultKeyShares(b, a)).toBe(key);
    }
  });

  it("ignores whitespace when combining pasted shares", () => {
    const key = "quiet-light-bridge-shore-A1B2C3D4";
    const [a, b] = splitVaultKey(key);
    expect(combineVaultKeyShares(` ${a} \n`, `\n${b} `)).toBe(key);
  });

  it("rejects shares from different splits", () => {
    const first = splitVaultKey("quiet-light-bridge-shore-A1B2C3D4");
    const second = splitVaultKey("quiet-light-bridge-shore-A1B2C3D4");
    expect(() => combineVaultKeyShares(first[0], second[1])).toThrow(ShareError);
  });

  it("does not treat a normal vault key as a share", () => {
    expect(looksLikeVaultShare("quiet-light-bridge-shore-A1B2C3D4")).toBe(false);
    expect(looksLikeVaultShare("тихий-свет-мост-берег-A1B2C3D4")).toBe(false);
  });
});
