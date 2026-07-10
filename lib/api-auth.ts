import { NextResponse } from "next/server";
import { extractVaultKey } from "@/lib/crypto";
import { authenticateVault } from "@/lib/vault";

export async function requireVault(request: Request): Promise<{ vaultId: string } | NextResponse> {
  const key = extractVaultKey(request.headers.get("authorization"));
  if (!key) {
    return NextResponse.json({ error: "Код доступа не указан" }, { status: 401 });
  }

  const vaultId = await authenticateVault(key);
  if (!vaultId) {
    return NextResponse.json({ error: "Неверный код доступа" }, { status: 403 });
  }

  return { vaultId };
}
