// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_RATE_LIMIT_MAX,
  INVALID_CODE_ERROR,
  resetAuthRateLimitStoreForTests,
} from "@/lib/rate-limit";

vi.mock("@/lib/vault", () => ({
  authenticateVault: vi.fn(),
  findKnownVaultId: vi.fn(),
}));

vi.mock("@/lib/vault-events", () => ({
  recordVaultEvent: vi.fn(),
}));

import { authenticateVault, findKnownVaultId } from "@/lib/vault";
import { recordVaultEvent } from "@/lib/vault-events";
import { POST } from "@/app/api/vault/verify/route";

const authenticateVaultMock = vi.mocked(authenticateVault);
const findKnownVaultIdMock = vi.mocked(findKnownVaultId);
const recordVaultEventMock = vi.mocked(recordVaultEvent);

const VAULT_ID = "ab".repeat(32);
const PROOF_BYTES = Buffer.alloc(32, 9);
const AUTH_BODY = { vaultId: VAULT_ID, proof: PROOF_BYTES.toString("base64url") };
const WRAP = {
  wrappedDek: Buffer.alloc(48, 2).toString("base64url"),
  dekNonce: Buffer.alloc(12, 3).toString("base64url"),
};

function verifyRequest(body: unknown, ip = "203.0.113.30"): Request {
  return new Request("http://localhost/api/vault/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/vault/verify", () => {
  beforeEach(() => {
    resetAuthRateLimitStoreForTests();
    authenticateVaultMock.mockReset();
    findKnownVaultIdMock.mockReset();
    recordVaultEventMock.mockReset();
    findKnownVaultIdMock.mockResolvedValue(null);
    recordVaultEventMock.mockResolvedValue(undefined);
  });

  it("returns the same 403 for a missing key, empty key, and unknown vault", async () => {
    authenticateVaultMock.mockResolvedValue(null);

    const missing = await POST(
      new Request("http://localhost/api/vault/verify", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.31" },
        body: "not-json",
      })
    );
    const empty = await POST(verifyRequest({ vaultId: "", proof: "" }, "203.0.113.32"));
    const unknown = await POST(verifyRequest(AUTH_BODY, "203.0.113.33"));

    expect(missing.status).toBe(403);
    expect(empty.status).toBe(403);
    expect(unknown.status).toBe(403);
    expect(await missing.json()).toEqual({ error: INVALID_CODE_ERROR });
    expect(await empty.json()).toEqual({ error: INVALID_CODE_ERROR });
    expect(await unknown.json()).toEqual({ error: INVALID_CODE_ERROR });
  });

  it("accepts a valid auth secret and returns the wrapped DEK", async () => {
    authenticateVaultMock.mockResolvedValue({
      vaultId: "vault-id",
      role: "master",
      permissions: ["read", "download", "upload", "manage"],
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
    });
    const res = await POST(verifyRequest(AUTH_BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      valid: true,
      role: "master",
      permissions: ["read", "download", "upload", "manage"],
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
    });
    expect(recordVaultEventMock).toHaveBeenCalledWith(expect.any(Request), "vault-id", "login");
  });

  it("logs verify_fail only when the code maps to a known vault", async () => {
    authenticateVaultMock.mockResolvedValue(null);
    findKnownVaultIdMock.mockResolvedValue("vault-id");

    const known = await POST(verifyRequest(AUTH_BODY));
    expect(known.status).toBe(403);
    expect(recordVaultEventMock).toHaveBeenCalledWith(
      expect.any(Request),
      "vault-id",
      "verify_fail"
    );

    recordVaultEventMock.mockClear();
    findKnownVaultIdMock.mockResolvedValue(null);
    const unknown = await POST(
      verifyRequest(
        { vaultId: "cd".repeat(32), proof: Buffer.alloc(32, 8).toString("base64url") },
        "203.0.113.34"
      )
    );
    expect(unknown.status).toBe(403);
    expect(recordVaultEventMock).not.toHaveBeenCalled();
  });

  it("rate-limits verify attempts per IP", async () => {
    authenticateVaultMock.mockResolvedValue(null);

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      const res = await POST(
        verifyRequest({
          vaultId: VAULT_ID,
          proof: Buffer.alloc(32, i + 1).toString("base64url"),
        })
      );
      expect(res.status).toBe(403);
    }

    const limited = await POST(
      verifyRequest({ vaultId: VAULT_ID, proof: Buffer.alloc(32, 99).toString("base64url") })
    );
    expect(limited.status).toBe(429);
  });
});
