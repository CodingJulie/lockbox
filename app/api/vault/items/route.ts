import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { getVaultItems } from "@/lib/vault";
import { logServerError } from "@/lib/safe-log";

export async function GET(request: Request) {
  const auth = await requireVault(request, "read");
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await getVaultItems(auth.vaultId);
    return NextResponse.json({ items });
  } catch (error) {
    logServerError("List items failed:", error);
    return NextResponse.json({ error: "Не удалось загрузить список" }, { status: 500 });
  }
}
