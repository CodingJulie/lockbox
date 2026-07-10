// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MASTER_PERMISSIONS } from "@/lib/vault-permissions";
import { INVALID_CODE_ERROR, resetAuthRateLimitStoreForTests } from "@/lib/rate-limit";
import { INSUFFICIENT_PERMISSION_CODE } from "@/lib/api-auth";

vi.mock("@/lib/vault", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault")>();
  return {
    ...actual,
    authenticateVault: vi.fn(),
    createVaultAccessKey: vi.fn(),
    listVaultAccessKeys: vi.fn(),
    revokeVaultAccessKey: vi.fn(),
  };
});

import { authenticateVault, createVaultAccessKey, listVaultAccessKeys } from "@/lib/vault";
import { GET, POST } from "@/app/api/vault/keys/route";

const authenticateVaultMock = vi.mocked(authenticateVault);
const createVaultAccessKeyMock = vi.mocked(createVaultAccessKey);
const listVaultAccessKeysMock = vi.mocked(listVaultAccessKeys);

const VAULT_ID = "ab".repeat(32);
const PROOF_BYTES = Buffer.alloc(32, 9);
const AUTH_TOKEN = `${VAULT_ID}.${PROOF_BYTES.toString("base64url")}`;
const WRAP = {
  wrappedDek: Buffer.alloc(48, 2).toString("base64url"),
  dekNonce: Buffer.alloc(12, 3).toString("base64url"),
};

const MASTER_AUTH = {
  vaultId: "vault-id",
  role: "master" as const,
  permissions: [...MASTER_PERMISSIONS],
  wrappedDek: WRAP.wrappedDek,
  dekNonce: WRAP.dekNonce,
};

function keysRequest(init?: RequestInit, ip = "203.0.113.60"): Request {
  return new Request("http://localhost/api/vault/keys", {
    ...init,
    headers: {
      authorization: `Bearer ${AUTH_TOKEN}`,
      "x-forwarded-for": ip,
      ...(init?.headers ?? {}),
    },
  });
}

describe("/api/vault/keys", () => {
  beforeEach(() => {
    resetAuthRateLimitStoreForTests();
    authenticateVaultMock.mockReset();
    createVaultAccessKeyMock.mockReset();
    listVaultAccessKeysMock.mockReset();
    authenticateVaultMock.mockResolvedValue(MASTER_AUTH);
  });

  it("lists access keys for the master code", async () => {
    listVaultAccessKeysMock.mockResolvedValue([
      {
        id: "sub-id",
        permissions: ["read", "download"],
        expiresAt: "2026-10-17T00:00:00.000Z",
        revokedAt: null,
        createdAt: "2026-09-17T00:00:00.000Z",
      },
    ]);

    const res = await GET(keysRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      keys: [
        {
          id: "sub-id",
          permissions: ["read", "download"],
          expiresAt: "2026-10-17T00:00:00.000Z",
          revokedAt: null,
          createdAt: "2026-09-17T00:00:00.000Z",
        },
      ],
    });
  });

  it("creates a lawyer sub-key with read/download and 30-day expiry", async () => {
    createVaultAccessKeyMock.mockResolvedValue({
      accessKey: {
        id: "sub-id",
        permissions: ["read", "download"],
        expiresAt: "2026-10-17T00:00:00.000Z",
        revokedAt: null,
        createdAt: "2026-09-17T00:00:00.000Z",
      },
    });

    const res = await POST(
      keysRequest({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          permissions: ["read", "download"],
          expiresInDays: 30,
          vaultId: VAULT_ID,
          proof: PROOF_BYTES.toString("base64url"),
          ...WRAP,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBeUndefined();
    expect(body.accessKey.id).toBe("sub-id");
    expect(createVaultAccessKeyMock).toHaveBeenCalledWith("vault-id", ["read", "download"], 30, {
      vaultId: VAULT_ID,
      proof: PROOF_BYTES.toString("hex"),
      ...WRAP,
    });
  });

  it("rejects manage permission on a sub-key", async () => {
    const res = await POST(
      keysRequest({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ permissions: ["manage"], expiresInDays: 30 }),
      })
    );
    expect(res.status).toBe(400);
    expect(createVaultAccessKeyMock).not.toHaveBeenCalled();
  });

  it("forbids a read-only sub-key from creating more keys", async () => {
    authenticateVaultMock.mockResolvedValue({
      vaultId: "vault-id",
      role: "sub",
      permissions: ["read", "download"],
      accessKeyId: "sub-id",
      wrappedDek: WRAP.wrappedDek,
      dekNonce: WRAP.dekNonce,
    });

    const res = await GET(keysRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: INSUFFICIENT_PERMISSION_CODE });
    expect(listVaultAccessKeysMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request", async () => {
    authenticateVaultMock.mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/vault/keys", {
        headers: { "x-forwarded-for": "203.0.113.61" },
      })
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: INVALID_CODE_ERROR });
  });
});
