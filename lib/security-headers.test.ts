// @vitest-environment node

import { describe, expect, it } from "vitest";
import { FFMPEG_CORE_BASE } from "@/lib/video-compression";
import {
  HSTS_VALUE,
  buildContentSecurityPolicy,
  buildPermissionsPolicy,
  getGlobalSecurityHeaders,
} from "@/lib/security-headers";

function headerMap(isProd: boolean): Record<string, string> {
  return Object.fromEntries(getGlobalSecurityHeaders(isProd).map((h) => [h.key, h.value]));
}

describe("security headers", () => {
  it("sends HSTS only in production", () => {
    expect(headerMap(true)["Strict-Transport-Security"]).toBe(HSTS_VALUE);
    expect(headerMap(false)["Strict-Transport-Security"]).toBeUndefined();
  });

  it("denies framing", () => {
    expect(headerMap(true)["X-Frame-Options"]).toBe("DENY");
    expect(buildContentSecurityPolicy(true)).toContain("frame-ancestors 'none'");
  });

  it("allows same-origin ffmpeg.wasm blob workers, nothing else remote", () => {
    const csp = buildContentSecurityPolicy(true);
    expect(FFMPEG_CORE_BASE).toBe("/ffmpeg");
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("cdn.jsdelivr.net");
    expect(csp).not.toContain("*");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("keeps eval and websockets for local Next.js HMR", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("expands Permissions-Policy beyond camera and microphone", () => {
    const policy = buildPermissionsPolicy();
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("autoplay=(self)");
    expect(policy).toContain("clipboard-write=(self)");
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("payment=()");
    expect(policy).toContain("browsing-topics=()");
  });
});
