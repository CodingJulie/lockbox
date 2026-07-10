import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { getVaultItems } from "@/lib/vault";

export async function GET(request: Request) {
  const auth = await requireVault(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await getVaultItems(auth.vaultId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("List items failed:", error);
    return NextResponse.json({ error: "Не удалось загрузить список" }, { status: 500 });
  }
}
