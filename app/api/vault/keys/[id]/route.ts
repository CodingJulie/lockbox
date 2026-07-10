import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { revokeVaultAccessKey } from "@/lib/vault";
import { logServerError } from "@/lib/safe-log";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVault(request, "manage");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Код не найден" }, { status: 404 });
  }

  try {
    const revoked = await revokeVaultAccessKey(auth.vaultId, id);
    if (!revoked) {
      return NextResponse.json({ error: "Код не найден" }, { status: 404 });
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    logServerError("Revoke access key failed:", error);
    return NextResponse.json({ error: "Не удалось отозвать код" }, { status: 500 });
  }
}
