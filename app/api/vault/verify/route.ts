import { NextResponse } from "next/server";
import { authenticateVault, findKnownVaultId } from "@/lib/vault";
import { consumeAuthAttempt, delayFailedAuth, invalidCodeResponse } from "@/lib/rate-limit";
import { recordVaultEvent } from "@/lib/vault-events";
import { parseVaultAuthPayload } from "@/lib/crypto";

export async function POST(request: Request) {
  const limited = await consumeAuthAttempt(request);
  if (limited) return limited;

  try {
    let authMaterial: { vaultId: string; proof: string } | null = null;
    try {
      const body = await request.json();
      authMaterial = parseVaultAuthPayload(body ?? {});
    } catch {
      authMaterial = null;
    }

    const auth = authMaterial ? await authenticateVault(authMaterial) : null;
    if (!auth) {
      const knownVaultId = authMaterial ? await findKnownVaultId(authMaterial.vaultId) : null;
      if (knownVaultId) await recordVaultEvent(request, knownVaultId, "verify_fail");
      await delayFailedAuth();
      return invalidCodeResponse();
    }

    await recordVaultEvent(request, auth.vaultId, "login");

    return NextResponse.json({
      valid: true,
      role: auth.role,
      permissions: auth.permissions,
      wrappedDek: auth.wrappedDek,
      dekNonce: auth.dekNonce,
    });
  } catch {
    await delayFailedAuth();
    return invalidCodeResponse();
  }
}
