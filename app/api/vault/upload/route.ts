import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { saveFileEvidence } from "@/lib/vault";
import { recordVaultEvent } from "@/lib/vault-events";
import { parseContentNonce, parseEncryptedMeta } from "@/lib/crypto";
import { logServerError } from "@/lib/safe-log";
import type { EvidenceType } from "@/lib/types";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const TYPES = new Set<EvidenceType>(["file", "audio", "video"]);

function parseType(value: unknown): EvidenceType {
  return typeof value === "string" && TYPES.has(value as EvidenceType)
    ? (value as EvidenceType)
    : "file";
}

export async function POST(request: Request) {
  const auth = await requireVault(request, "upload");
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const nonce = parseContentNonce(formData.get("nonce"));
    const encryptedMeta = parseEncryptedMeta(formData.get("encryptedMeta"));
    const type = parseType(formData.get("type"));

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
    }

    if (!nonce || !encryptedMeta) {
      return NextResponse.json({ error: "Некорректные параметры шифрования" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Файл слишком большой (максимум 50 МБ)" }, { status: 400 });
    }

    const ciphertext = Buffer.from(await file.arrayBuffer());
    const item = await saveFileEvidence(auth.vaultId, ciphertext, type, nonce, encryptedMeta);

    await recordVaultEvent(request, auth.vaultId, "upload");

    return NextResponse.json({ item });
  } catch (error) {
    logServerError("Upload failed:", error);
    return NextResponse.json({ error: "Не удалось загрузить файл" }, { status: 500 });
  }
}
