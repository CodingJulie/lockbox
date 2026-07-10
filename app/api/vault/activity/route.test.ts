// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MASTER_PERMISSIONS } from "@/lib/vault-permissions";
import { INSUFFICIENT_PERMISSION_CODE } from "@/lib/api-auth";
import { resetAuthRateLimitStoreForTests } from "@/lib/rate-limit";

vi.mock("@/lib/vault", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault")>();
  return {
    ...actual,
    authenticateVault: vi.fn(),
  };
});

vi.mock("@/lib/vault-events", () => ({
  getVaultActivity: vi.fn(),
  recordVaultEvent: vi.fn(),
}));

import { authenticateVault } from "@/lib/vault";
import { getVaultActivity } from "@/lib/vault-events";
import { GET } from "@/app/api/vault/activity/route";

const authenticateVaultMock = vi.mocked(authenticateVault);
const getVaultActivityMock = vi.mocked(getVaultActivity);

const VAULT_ID = "ab".repeat(32);
const PROOF_BYTES = Buffer.alloc(32, 9);
const AUTH_TOKEN = `${VAULT_ID}.${PROOF_BYTES.toString("base64url")}`;
const WRAP = {
  wrappedDek: Buffer.alloc(48, 2).toString("base64url"),
  dekNonce: Buffer.alloc(12, 3).toString("base64url"),
};

function activityRequest(token = AUTH_TOKEN): Request {
  return new Request("http://localhost/api/vault/activity", {
    headers: {
      authorization: `Bearer ${token}`,
      "x-forwarded-for": "203.0.113.70",
    },
  });
}

describe("GET /api/vault/activity", () => {
  beforeEach(() => {
    resetAuthRateLimitStoreForTests();
    authenticateVaultMock.mockReset();
    getVaultActivityMock.mockReset();
    authenticateVaultMock.mockResolvedValue({
      vaultId: "vault-id",
      role: "master",
      permissions: [...MASTER_PERMISSIONS],
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
    });
    getVaultActivityMock.mockResolvedValue({
      lastLoginAt: "2026-03-03T12:00:00.000Z",
      downloads: 2,
      uploads: 0,
      failedVerifies: 0,
    });
  });

  it("returns an aggregated summary without raw events", async () => {
    const res = await GET(activityRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      lastLoginAt: "2026-03-03T12:00:00.000Z",
      downloads: 2,
      uploads: 0,
      failedVerifies: 0,
    });
    expect(getVaultActivityMock).toHaveBeenCalledWith("vault-id");
  });

  it("forbids a sub-key without manage from reading the log", async () => {
    authenticateVaultMock.mockResolvedValue({
      vaultId: "vault-id",
      role: "sub",
      permissions: ["read", "download"],
      accessKeyId: "sub-id",
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
    });

    const res = await GET(activityRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: INSUFFICIENT_PERMISSION_CODE });
    expect(getVaultActivityMock).not.toHaveBeenCalled();
  });
});
