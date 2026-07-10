import { NextResponse } from "next/server";
import { createNewVault, VaultExistsError } from "@/lib/vault";
import { getStorageMode } from "@/lib/storage";
import { consumeVaultCreateAttempt } from "@/lib/rate-limit";
import { recordVaultEvent } from "@/lib/vault-events";
import { parseVaultAuthPayload, parseDekWrap } from "@/lib/crypto";
import { logServerError } from "@/lib/safe-log";

export async function POST(request: Request) {
  const limited = await consumeVaultCreateAttempt(request);
  if (limited) return limited;

  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const auth = parseVaultAuthPayload(body);
    const wrap = parseDekWrap(body.wrappedDek, body.dekNonce);
    if (!auth || !wrap) {
      return NextResponse.json({ error: "Некорректные параметры хранилища" }, { status: 400 });
    }

    const { vaultId } = await createNewVault({
      vaultId: auth.vaultId,
      proof: auth.proof,
      wrappedDek: wrap.wrappedDek,
      dekNonce: wrap.dekNonce,
    });
    await recordVaultEvent(request, vaultId, "login");
    return NextResponse.json({
      storageMode: getStorageMode(),
      message: "Хранилище создано. Код доступа остаётся только у вас.",
    });
  } catch (error) {
    if (error instanceof VaultExistsError) {
      return NextResponse.json({ error: "Хранилище уже существует" }, { status: 409 });
    }

    const detail = error instanceof Error ? error.message : "Unknown error";
    const hint =
      detail.includes("relation") || detail.includes("does not exist")
        ? "Выполните SQL-миграцию из supabase/migrations/001_initial.sql"
        : detail.includes("row-level security") || detail.includes("policy")
          ? "Добавьте RLS-политики — см. supabase/migrations/001_initial.sql"
          : undefined;

    logServerError("Vault creation failed:", error);
    if (hint) logServerError("Vault creation hint:", hint);

    return NextResponse.json({ error: "Не удалось создать хранилище" }, { status: 500 });
  }
}
