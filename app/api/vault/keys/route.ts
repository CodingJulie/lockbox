import { NextResponse } from "next/server";
import { requireVault } from "@/lib/api-auth";
import {
  AccessKeyConflictError,
  AccessKeyLimitError,
  createVaultAccessKey,
  listVaultAccessKeys,
} from "@/lib/vault";
import { parseExpiresInDays, parseSubKeyPermissions } from "@/lib/vault-permissions";
import { parseDekWrap, parseVaultAuthPayload } from "@/lib/crypto";
import { logServerError } from "@/lib/safe-log";

export async function GET(request: Request) {
  const auth = await requireVault(request, "manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const keys = await listVaultAccessKeys(auth.vaultId);
    return NextResponse.json({ keys });
  } catch (error) {
    logServerError("List access keys failed:", error);
    return NextResponse.json({ error: "Не удалось загрузить коды доступа" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireVault(request, "manage");
  if (auth instanceof NextResponse) return auth;

  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const permissions = parseSubKeyPermissions(body.permissions);
    if (!permissions) {
      return NextResponse.json({ error: "Укажите права доступа" }, { status: 400 });
    }

    const expiresInDays = parseExpiresInDays(body.expiresInDays);
    if (expiresInDays === undefined) {
      return NextResponse.json({ error: "Некорректный срок действия" }, { status: 400 });
    }

    const subAuth = parseVaultAuthPayload(body);
    const wrap = parseDekWrap(body.wrappedDek, body.dekNonce);
    if (!subAuth || !wrap) {
      return NextResponse.json({ error: "Некорректные параметры шифрования" }, { status: 400 });
    }

    const { accessKey } = await createVaultAccessKey(auth.vaultId, permissions, expiresInDays, {
      vaultId: subAuth.vaultId,
      proof: subAuth.proof,
      wrappedDek: wrap.wrappedDek,
      dekNonce: wrap.dekNonce,
    });

    return NextResponse.json({
      accessKey,
      message: "Сохраните этот код. Он показывается только один раз.",
    });
  } catch (error) {
    if (error instanceof AccessKeyLimitError) {
      return NextResponse.json({ error: "Слишком много активных кодов доступа" }, { status: 400 });
    }
    if (error instanceof AccessKeyConflictError) {
      return NextResponse.json({ error: "Код уже существует" }, { status: 409 });
    }
    logServerError("Create access key failed:", error);
    return NextResponse.json({ error: "Не удалось создать код доступа" }, { status: 500 });
  }
}
