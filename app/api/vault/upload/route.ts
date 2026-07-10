import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { saveFileEvidence } from "@/lib/vault";
import type { EvidenceType } from "@/lib/types";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function detectType(mimeType: string): EvidenceType {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

export async function POST(request: Request) {
  const auth = await requireVault(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const typeOverride = formData.get("type") as EvidenceType | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Файл слишком большой (максимум 50 МБ)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const type = typeOverride || detectType(mimeType);

    const item = await saveFileEvidence(
      auth.vaultId,
      buffer,
      type,
      file.name || `upload-${Date.now()}`,
      mimeType
    );

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Upload failed:", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Не удалось загрузить файл",
        ...(process.env.NODE_ENV === "development" && { detail }),
      },
      { status: 500 }
    );
  }
}
