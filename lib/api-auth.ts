import { NextResponse } from "next/server";
import { extractVaultAuth } from "@/lib/crypto";
import { authenticateVault } from "@/lib/vault";
import { rejectInvalidAuth } from "@/lib/rate-limit";
import { hasPermission, type VaultPermission } from "@/lib/vault-permissions";
import type { VaultAuth } from "@/lib/types";

export const INSUFFICIENT_PERMISSION_ERROR = "Недостаточно прав";
export const INSUFFICIENT_PERMISSION_CODE = "forbidden";

export function insufficientPermissionResponse(): NextResponse {
  return NextResponse.json(
    { error: INSUFFICIENT_PERMISSION_ERROR, code: INSUFFICIENT_PERMISSION_CODE },
    { status: 403 }
  );
}

export async function requireVault(
  request: Request,
  permission?: VaultPermission
): Promise<VaultAuth | NextResponse> {
  const material = extractVaultAuth(request.headers.get("authorization"));
  if (!material) {
    return rejectInvalidAuth(request);
  }

  const auth = await authenticateVault(material);
  if (!auth) {
    return rejectInvalidAuth(request);
  }

  if (permission && !hasPermission(auth.permissions, permission)) {
    return insufficientPermissionResponse();
  }

  return auth;
}
