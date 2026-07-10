import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { saveTextEvidence } from "@/lib/vault";
import { recordVaultEvent } from "@/lib/vault-events";
import { parseContentNonce, parseEncryptedMeta } from "@/lib/crypto";
import { logServerError } from "@/lib/safe-log";

const MAX_TEXT_SIZE = 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireVault(request, "upload");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const nonce = parseContentNonce(body?.nonce);
    const encryptedMeta = parseEncryptedMeta(body?.encryptedMeta);
    const ciphertext =
      typeof body?.ciphertext === "string" && body.ciphertext ? body.ciphertext : null;

    if (!nonce || !encryptedMeta || !ciphertext) {
      return NextResponse.json({ error: "Некорректные параметры шифрования" }, { status: 400 });
    }

    let size = 0;
    try {
      size = Buffer.from(ciphertext, "base64url").length;
    } catch {
      return NextResponse.json({ error: "Некорректные параметры шифрования" }, { status: 400 });
    }

    if (size === 0 || size > MAX_TEXT_SIZE) {
      return NextResponse.json({ error: "Текст не может быть пустым" }, { status: 400 });
    }

    const item = await saveTextEvidence(auth.vaultId, ciphertext, nonce, encryptedMeta, size);
    await recordVaultEvent(request, auth.vaultId, "upload");
    return NextResponse.json({ item });
  } catch (error) {
    logServerError("Save text failed:", error);
    return NextResponse.json({ error: "Не удалось сохранить текст" }, { status: 500 });
  }
}
