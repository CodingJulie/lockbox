// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOO_MANY_VAULTS_ERROR,
  VAULT_CREATE_RATE_LIMIT_MAX,
  resetAuthRateLimitStoreForTests,
} from "@/lib/rate-limit";

vi.mock("@/lib/vault", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault")>();
  return {
    ...actual,
    createNewVault: vi.fn(),
  };
});

vi.mock("@/lib/storage", () => ({
  getStorageMode: vi.fn(() => "local"),
}));

vi.mock("@/lib/vault-events", () => ({
  recordVaultEvent: vi.fn(),
}));

import { createNewVault } from "@/lib/vault";
import { POST } from "@/app/api/vault/route";

const createNewVaultMock = vi.mocked(createNewVault);

const VAULT_ID = "ab".repeat(32);
const PROOF_BYTES = Buffer.alloc(32, 9);
const WRAP = {
  wrappedDek: Buffer.alloc(48, 2).toString("base64url"),
  dekNonce: Buffer.alloc(12, 3).toString("base64url"),
};

function createRequest(locale = "ru", ip = "203.0.113.40"): Request {
  return new Request("http://localhost/api/vault", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({
      locale,
      vaultId: VAULT_ID,
      proof: PROOF_BYTES.toString("base64url"),
      ...WRAP,
    }),
  });
}

describe("POST /api/vault", () => {
  beforeEach(() => {
    createNewVaultMock.mockReset();
    resetAuthRateLimitStoreForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAuthRateLimitStoreForTests();
  });

  it("does not leak database error detail or hint to the client in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    createNewVaultMock.mockRejectedValue(new Error('relation "vaults" does not exist'));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(createRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Не удалось создать хранилище" });
    expect(body).not.toHaveProperty("detail");
    expect(body).not.toHaveProperty("hint");
    expect(errorSpy).toHaveBeenCalledWith(
      "Vault creation failed:",
      expect.stringContaining("relation")
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "Vault creation hint:",
      "Выполните SQL-миграцию из supabase/migrations/001_initial.sql"
    );

    errorSpy.mockRestore();
  });

  it("rate-limits vault creation to 3 per IP per day", async () => {
    createNewVaultMock.mockResolvedValue({ vaultId: "id" });

    for (let i = 0; i < VAULT_CREATE_RATE_LIMIT_MAX; i++) {
      const res = await POST(createRequest("ru", "203.0.113.50"));
      expect(res.status).toBe(200);
    }

    const limited = await POST(createRequest("ru", "203.0.113.50"));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: TOO_MANY_VAULTS_ERROR });
    expect(createNewVaultMock).toHaveBeenCalledTimes(VAULT_CREATE_RATE_LIMIT_MAX);
  });

  it("isolates vault-create limits per IP", async () => {
    createNewVaultMock.mockResolvedValue({ vaultId: "id" });

    for (let i = 0; i < VAULT_CREATE_RATE_LIMIT_MAX; i++) {
      expect((await POST(createRequest("ru", "203.0.113.51"))).status).toBe(200);
    }

    expect((await POST(createRequest("ru", "203.0.113.51"))).status).toBe(429);
    expect((await POST(createRequest("ru", "203.0.113.52"))).status).toBe(200);
  });
});
