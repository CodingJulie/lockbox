import { NextResponse } from "next/server";
import { authenticateVault } from "@/lib/vault";

export async function POST(request: Request) {
  try {
    const { key } = await request.json();
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Укажите код доступа" }, { status: 400 });
    }

    const vaultId = await authenticateVault(key);
    if (!vaultId) {
      return NextResponse.json({ error: "Неверный код доступа" }, { status: 403 });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ error: "Ошибка проверки кода" }, { status: 500 });
  }
}
