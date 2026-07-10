import { describe, expect, it } from "vitest";
import { hashClientIp } from "@/lib/audit-ip";

describe("hashClientIp", () => {
  it("returns a stable HMAC hex digest and never embeds the raw IP", () => {
    const ip = "203.0.113.10";
    const hash = hashClientIp(ip);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashClientIp(ip));
    expect(hash).not.toBe(hashClientIp("203.0.113.11"));
    expect(hash).not.toBe(ip);
  });
});
