import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import { getEvidenceFile } from "@/lib/vault";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVault(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const result = await getEvidenceFile(auth.vaultId, id);
    if (!result) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    }

    const { item, data } = result;
    const mimeType = item.mimeType || "application/octet-stream";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(item.name)}"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (error) {
    console.error("Download failed:", error);
    return NextResponse.json({ error: "Не удалось скачать файл" }, { status: 500 });
  }
}
