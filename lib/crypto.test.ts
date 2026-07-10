import { describe, it, expect } from "vitest";
import { generateVaultKey } from "@/lib/crypto";

const KEY_PATTERN = /^[\p{L}]+(?:-[\p{L}]+){3}-[A-F0-9]{4}$/u;

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
    expect(key).toMatch(/^[a-z]+(?:-[a-z]+){3}-[A-F0-9]{4}$/);
  });
});
