import { NextResponse } from "next/server";
import { createNewVault } from "@/lib/vault";
import { getStorageMode } from "@/lib/storage";
import type { AppLanguage } from "@/lib/detect-locale";

function parseLocale(value: unknown): AppLanguage {
  return value === "en" ? "en" : "ru";
}

export async function POST(request: Request) {
  try {
    let locale: AppLanguage = "ru";
    try {
      const body = await request.json();
      locale = parseLocale(body?.locale);
    } catch {}

    const { key } = await createNewVault(locale);
    return NextResponse.json({
      key,
      storageMode: getStorageMode(),
      message: "Сохраните этот код в надёжном месте. Он показывается только один раз.",
    });
  } catch (error) {
    console.error("Vault creation failed:", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    const hint =
      detail.includes("relation") || detail.includes("does not exist")
        ? "Выполните SQL-миграцию из supabase/migrations/001_initial.sql"
        : detail.includes("row-level security") || detail.includes("policy")
          ? "Добавьте RLS-политики — см. supabase/migrations/001_initial.sql"
          : undefined;

    return NextResponse.json(
      {
        error: "Не удалось создать хранилище",
        ...(process.env.NODE_ENV === "development" && { detail, hint }),
      },
      { status: 500 }
    );
  }
}
