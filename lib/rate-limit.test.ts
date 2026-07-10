// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  INVALID_CODE_ERROR,
  TOO_MANY_ATTEMPTS_ERROR,
  TOO_MANY_VAULTS_ERROR,
  VAULT_CREATE_RATE_LIMIT_MAX,
  VAULT_CREATE_RATE_LIMIT_WINDOW_MS,
  checkAuthRateLimit,
  checkVaultCreateRateLimit,
  consumeAuthAttempt,
  consumeVaultCreateAttempt,
  failedAuthDelayMs,
  getClientIp,
  resetAuthRateLimitStoreForTests,
} from "@/lib/rate-limit";

function requestWithIp(ip: string, extraHeaders?: HeadersInit): Request {
  return new Request("http://localhost/api/vault/verify", {
    method: "POST",
    headers: { "x-forwarded-for": ip, ...extraHeaders },
  });
}

describe("auth rate limit", () => {
  beforeEach(() => {
    resetAuthRateLimitStoreForTests();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAuthRateLimitStoreForTests();
  });

  it("reads the first forwarded IP", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("prefers Vercel forwarded-for", () => {
    const request = new Request("http://localhost/", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.2",
        "x-forwarded-for": "203.0.113.10",
      },
    });
    expect(getClientIp(request)).toBe("198.51.100.2");
  });

  it("allows 10 attempts then returns 429", async () => {
    const request = requestWithIp("203.0.113.8");

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      expect(await consumeAuthAttempt(request)).toBeNull();
    }

    const limited = await consumeAuthAttempt(request);
    expect(limited).not.toBeNull();
    expect(limited?.status).toBe(429);
    const body = await limited?.json();
    expect(body.error).toBe(TOO_MANY_ATTEMPTS_ERROR);
    expect(limited?.headers.get("Retry-After")).toBeTruthy();
  });

  it("isolates limits per IP", async () => {
    const first = requestWithIp("203.0.113.1");
    const second = requestWithIp("203.0.113.2");

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      expect(await consumeAuthAttempt(first)).toBeNull();
    }

    expect(await consumeAuthAttempt(first)).not.toBeNull();
    expect(await consumeAuthAttempt(second)).toBeNull();
  });

  it("resets after the 15 minute window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const request = requestWithIp("203.0.113.9");

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      expect((await checkAuthRateLimit(request)).success).toBe(true);
    }
    expect((await checkAuthRateLimit(request)).success).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z").getTime() + AUTH_RATE_LIMIT_WINDOW_MS);
    expect((await checkAuthRateLimit(request)).success).toBe(true);
  });

  it("keeps failed-auth delay in the 100–500 ms range", () => {
    expect(failedAuthDelayMs(0)).toBe(100);
    expect(failedAuthDelayMs(1)).toBe(500);
    expect(failedAuthDelayMs(0.5)).toBeGreaterThanOrEqual(100);
    expect(failedAuthDelayMs(0.5)).toBeLessThanOrEqual(500);
  });
});

describe("vault create rate limit", () => {
  beforeEach(() => {
    resetAuthRateLimitStoreForTests();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAuthRateLimitStoreForTests();
  });

  it("allows 3 vaults per IP then returns 429", async () => {
    const request = requestWithIp("203.0.113.40");

    for (let i = 0; i < VAULT_CREATE_RATE_LIMIT_MAX; i++) {
      expect(await consumeVaultCreateAttempt(request)).toBeNull();
    }

    const limited = await consumeVaultCreateAttempt(request);
    expect(limited).not.toBeNull();
    expect(limited?.status).toBe(429);
    expect(await limited?.json()).toEqual({ error: TOO_MANY_VAULTS_ERROR });
    expect(limited?.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(limited?.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not share the auth limiter quota", async () => {
    const request = requestWithIp("203.0.113.41");

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      expect(await consumeAuthAttempt(request)).toBeNull();
    }
    expect(await consumeAuthAttempt(request)).not.toBeNull();
    expect(await consumeVaultCreateAttempt(request)).toBeNull();
  });

  it("resets after 24 hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const request = requestWithIp("203.0.113.42");

    for (let i = 0; i < VAULT_CREATE_RATE_LIMIT_MAX; i++) {
      expect((await checkVaultCreateRateLimit(request)).success).toBe(true);
    }
    expect((await checkVaultCreateRateLimit(request)).success).toBe(false);

    vi.setSystemTime(
      new Date("2026-01-01T00:00:00Z").getTime() + VAULT_CREATE_RATE_LIMIT_WINDOW_MS
    );
    expect((await checkVaultCreateRateLimit(request)).success).toBe(true);
  });
});

describe("invalid code message", () => {
  it("does not distinguish missing vault from a bad key", () => {
    expect(INVALID_CODE_ERROR).toBe("Неверный код");
  });
});
