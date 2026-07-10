import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { getEvidenceFile } from "@/lib/vault";
import { recordVaultEvent } from "@/lib/vault-events";
import { logServerError } from "@/lib/safe-log";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVault(request, "download");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const result = await getEvidenceFile(auth.vaultId, id);
    if (!result) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    }

    const { data } = result;

    await recordVaultEvent(request, auth.vaultId, "download");

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${id}.bin"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (error) {
    logServerError("Download failed:", error);
    return NextResponse.json({ error: "Не удалось скачать файл" }, { status: 500 });
  }
}
