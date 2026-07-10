import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { getVaultActivity } from "@/lib/vault-events";
import { logServerError } from "@/lib/safe-log";

export async function GET(request: Request) {
  const auth = await requireVault(request, "manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const activity = await getVaultActivity(auth.vaultId);
    return NextResponse.json(activity);
  } catch (error) {
    logServerError("List vault activity failed:", error);
    return NextResponse.json({ error: "Не удалось загрузить журнал" }, { status: 500 });
  }
}
