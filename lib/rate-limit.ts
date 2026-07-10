import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1];

type RateLimitPolicy = {
  max: number;
  window: Duration;
  windowMs: number;
  prefix: string;
};

export const AUTH_RATE_LIMIT = {
  max: 10,
  window: "15 m",
  windowMs: 15 * 60 * 1000,
  prefix: "lockbox:auth",
} as const satisfies RateLimitPolicy;

export const VAULT_CREATE_RATE_LIMIT = {
  max: 3,
  window: "1 d",
  windowMs: 24 * 60 * 60 * 1000,
  prefix: "lockbox:vault-create",
} as const satisfies RateLimitPolicy;

export const AUTH_RATE_LIMIT_MAX = AUTH_RATE_LIMIT.max;
export const AUTH_RATE_LIMIT_WINDOW = AUTH_RATE_LIMIT.window;
export const AUTH_RATE_LIMIT_WINDOW_MS = AUTH_RATE_LIMIT.windowMs;
export const VAULT_CREATE_RATE_LIMIT_MAX = VAULT_CREATE_RATE_LIMIT.max;
export const VAULT_CREATE_RATE_LIMIT_WINDOW = VAULT_CREATE_RATE_LIMIT.window;
export const VAULT_CREATE_RATE_LIMIT_WINDOW_MS = VAULT_CREATE_RATE_LIMIT.windowMs;

export const INVALID_CODE_ERROR = "Неверный код";
export const TOO_MANY_ATTEMPTS_ERROR = "Слишком много попыток. Попробуйте позже.";
export const TOO_MANY_VAULTS_ERROR = "Слишком много хранилищ. Попробуйте позже.";

const FAILED_AUTH_DELAY_MIN_MS = 100;
const FAILED_AUTH_DELAY_MAX_MS = 500;

type MemoryHits = Map<string, number[]>;

const globalForRateLimit = globalThis as typeof globalThis & {
  __lockboxRateHits?: Map<string, MemoryHits>;
  __lockboxUpstash?: Map<string, Ratelimit>;
  __lockboxLimitWarned?: boolean;
};

function memoryStore(prefix: string): MemoryHits {
  if (!globalForRateLimit.__lockboxRateHits) {
    globalForRateLimit.__lockboxRateHits = new Map();
  }
  let store = globalForRateLimit.__lockboxRateHits.get(prefix);
  if (!store) {
    store = new Map();
    globalForRateLimit.__lockboxRateHits.set(prefix, store);
  }
  return store;
}

export function isUpstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getUpstashLimiter(policy: RateLimitPolicy): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  if (!globalForRateLimit.__lockboxUpstash) {
    globalForRateLimit.__lockboxUpstash = new Map();
  }
  const cached = globalForRateLimit.__lockboxUpstash.get(policy.prefix);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(policy.max, policy.window),
    prefix: policy.prefix,
    analytics: true,
  });
  globalForRateLimit.__lockboxUpstash.set(policy.prefix, limiter);
  return limiter;
}

export function getClientIp(request: Request): string {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const ip = vercelForwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

export type AuthRateLimitResult = RateLimitResult;

function hitMemory(identifier: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const windowStart = now - policy.windowMs;
  const store = memoryStore(policy.prefix);
  const timestamps = (store.get(identifier) ?? []).filter((ts) => ts > windowStart);

  if (timestamps.length >= policy.max) {
    store.set(identifier, timestamps);
    const oldest = timestamps[0] ?? now;
    return { success: false, remaining: 0, reset: oldest + policy.windowMs };
  }

  timestamps.push(now);
  store.set(identifier, timestamps);
  return {
    success: true,
    remaining: policy.max - timestamps.length,
    reset: timestamps[0] + policy.windowMs,
  };
}

function warnIfEphemeralLimit(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (isUpstashConfigured() || globalForRateLimit.__lockboxLimitWarned) return;
  globalForRateLimit.__lockboxLimitWarned = true;
  console.warn(
    "Rate limits are in-memory only. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for Vercel."
  );
}

async function checkRateLimit(request: Request, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const identifier = getClientIp(request);
  const upstash = getUpstashLimiter(policy);

  if (upstash) {
    try {
      const result = await upstash.limit(identifier);
      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (error) {
      console.error(`Upstash rate limit failed (${policy.prefix}), falling back to memory:`, error);
    }
  } else {
    warnIfEphemeralLimit();
  }

  return hitMemory(identifier, policy);
}

export async function checkAuthRateLimit(request: Request): Promise<RateLimitResult> {
  return checkRateLimit(request, AUTH_RATE_LIMIT);
}

export async function checkVaultCreateRateLimit(request: Request): Promise<RateLimitResult> {
  return checkRateLimit(request, VAULT_CREATE_RATE_LIMIT);
}

function shouldSkipFailedAuthDelay(): boolean {
  return Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";
}

export function failedAuthDelayMs(random = Math.random()): number {
  const clamped = Math.min(1, Math.max(0, random));
  return (
    FAILED_AUTH_DELAY_MIN_MS +
    Math.round(clamped * (FAILED_AUTH_DELAY_MAX_MS - FAILED_AUTH_DELAY_MIN_MS))
  );
}

export async function delayFailedAuth(): Promise<void> {
  if (shouldSkipFailedAuthDelay()) return;
  await new Promise((resolve) => setTimeout(resolve, failedAuthDelayMs()));
}

export function invalidCodeResponse(): NextResponse {
  return NextResponse.json({ error: INVALID_CODE_ERROR }, { status: 403 });
}

function rateLimitedResponse(result: RateLimitResult, max: number, error: string): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    { error },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(max),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}

export function tooManyAttemptsResponse(result: RateLimitResult): NextResponse {
  return rateLimitedResponse(result, AUTH_RATE_LIMIT.max, TOO_MANY_ATTEMPTS_ERROR);
}

export function tooManyVaultsResponse(result: RateLimitResult): NextResponse {
  return rateLimitedResponse(result, VAULT_CREATE_RATE_LIMIT.max, TOO_MANY_VAULTS_ERROR);
}

/** Consume one auth attempt. Returns a 429 response when the IP is over the limit. */
export async function consumeAuthAttempt(request: Request): Promise<NextResponse | null> {
  const result = await checkAuthRateLimit(request);
  if (result.success) return null;
  return tooManyAttemptsResponse(result);
}

/** Consume one vault-create slot. Returns a 429 response when the IP is over 3 / day. */
export async function consumeVaultCreateAttempt(request: Request): Promise<NextResponse | null> {
  const result = await checkVaultCreateRateLimit(request);
  if (result.success) return null;
  return tooManyVaultsResponse(result);
}

/** Count a failed guess, wait a short jitter, then return the same 403 as any other bad code. */
export async function rejectInvalidAuth(request: Request): Promise<NextResponse> {
  const limited = await consumeAuthAttempt(request);
  if (limited) return limited;
  await delayFailedAuth();
  return invalidCodeResponse();
}

export function resetRateLimitStoresForTests(): void {
  globalForRateLimit.__lockboxRateHits?.clear();
  globalForRateLimit.__lockboxUpstash = undefined;
  globalForRateLimit.__lockboxLimitWarned = false;
}

export function resetAuthRateLimitStoreForTests(): void {
  resetRateLimitStoresForTests();
}
