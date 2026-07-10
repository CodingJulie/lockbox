import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { saveTextEvidence } from "@/lib/vault";

export async function POST(request: Request) {
  const auth = await requireVault(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { text, name } = await request.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Текст не может быть пустым" }, { status: 400 });
    }

    const item = await saveTextEvidence(auth.vaultId, text.trim(), name);
    return NextResponse.json({ item });
  } catch (error) {
    console.error("Save text failed:", error);
    return NextResponse.json({ error: "Не удалось сохранить текст" }, { status: 500 });
  }
}
