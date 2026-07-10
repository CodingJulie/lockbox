// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  AUTH_RATE_LIMIT_MAX,
  INVALID_CODE_ERROR,
  resetAuthRateLimitStoreForTests,
} from "@/lib/rate-limit";
import { MASTER_PERMISSIONS } from "@/lib/vault-permissions";
import { INSUFFICIENT_PERMISSION_CODE, INSUFFICIENT_PERMISSION_ERROR } from "@/lib/api-auth";

vi.mock("@/lib/vault", () => ({
  authenticateVault: vi.fn(),
}));

import { authenticateVault } from "@/lib/vault";
import { requireVault } from "@/lib/api-auth";

const authenticateVaultMock = vi.mocked(authenticateVault);

const VAULT_ID = "ab".repeat(32);
const PROOF_BYTES = Buffer.alloc(32, 9);
const AUTH_TOKEN = `${VAULT_ID}.${PROOF_BYTES.toString("base64url")}`;

const MASTER_AUTH = {
  vaultId: "vault-id",
  role: "master" as const,
  permissions: [...MASTER_PERMISSIONS],
  wrappedDek: Buffer.alloc(48, 2).toString("base64url"),
  dekNonce: Buffer.alloc(12, 3).toString("base64url"),
};

function authedRequest(token = AUTH_TOKEN, ip = "203.0.113.20"): Request {
  return new Request("http://localhost/api/vault/items", {
    headers: {
      authorization: `Bearer ${token}`,
      "x-forwarded-for": ip,
    },
  });
}

describe("requireVault", () => {
  beforeEach(() => {
    resetAuthRateLimitStoreForTests();
    authenticateVaultMock.mockReset();
  });

  it("returns the same invalid-code response for a missing header and a bad key", async () => {
    authenticateVaultMock.mockResolvedValue(null);

    const missing = await requireVault(new Request("http://localhost/api/vault/items"));
    const invalid = await requireVault(authedRequest());

    expect(missing).toBeInstanceOf(NextResponse);
    expect(invalid).toBeInstanceOf(NextResponse);
    expect((missing as NextResponse).status).toBe(403);
    expect((invalid as NextResponse).status).toBe(403);
    expect(await (missing as NextResponse).json()).toEqual({ error: INVALID_CODE_ERROR });
    expect(await (invalid as NextResponse).json()).toEqual({ error: INVALID_CODE_ERROR });
  });

  it("does not rate-limit successful vault access", async () => {
    authenticateVaultMock.mockResolvedValue(MASTER_AUTH);

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX + 2; i++) {
      const auth = await requireVault(authedRequest());
      expect(auth).toEqual(MASTER_AUTH);
    }
  });

  it("rate-limits repeated failed keys", async () => {
    authenticateVaultMock.mockResolvedValue(null);

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      const auth = await requireVault(authedRequest(`bad-token-${i}`));
      expect(auth).toBeInstanceOf(NextResponse);
      expect((auth as NextResponse).status).toBe(403);
    }

    const limited = await requireVault(authedRequest("bad-token-last"));
    expect(limited).toBeInstanceOf(NextResponse);
    expect((limited as NextResponse).status).toBe(429);
  });

  it("rejects a valid sub-key that lacks the required permission without counting as a guess", async () => {
    authenticateVaultMock.mockResolvedValue({
      vaultId: "vault-id",
      role: "sub",
      permissions: ["read", "download"],
      accessKeyId: "sub-id",
      wrappedDek: MASTER_AUTH.wrappedDek,
      dekNonce: MASTER_AUTH.dekNonce,
    });

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX + 2; i++) {
      const auth = await requireVault(authedRequest(), "upload");
      expect(auth).toBeInstanceOf(NextResponse);
      expect((auth as NextResponse).status).toBe(403);
      expect(await (auth as NextResponse).json()).toEqual({
        error: INSUFFICIENT_PERMISSION_ERROR,
        code: INSUFFICIENT_PERMISSION_CODE,
      });
    }

    const stillAllowed = await requireVault(authedRequest(), "read");
    expect(stillAllowed).toEqual({
      vaultId: "vault-id",
      role: "sub",
      permissions: ["read", "download"],
      accessKeyId: "sub-id",
      wrappedDek: MASTER_AUTH.wrappedDek,
      dekNonce: MASTER_AUTH.dekNonce,
    });
  });
});
