import type { VaultActivitySummary } from "@/lib/types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function formatActivityDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale.startsWith("ru") ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
  });
}

/** e.g. "Был вход 3 марта, 2 скачивания" */
export function formatVaultActivity(
  summary: VaultActivitySummary,
  t: Translate,
  locale: string
): string | null {
  const parts: string[] = [];

  if (summary.lastLoginAt) {
    parts.push(t("activity.lastLogin", { date: formatActivityDate(summary.lastLoginAt, locale) }));
  }
  if (summary.downloads > 0) {
    parts.push(t("activity.downloads", { count: summary.downloads }));
  }
  if (summary.uploads > 0) {
    parts.push(t("activity.uploads", { count: summary.uploads }));
  }
  if (summary.failedVerifies > 0) {
    parts.push(t("activity.failedVerifies", { count: summary.failedVerifies }));
  }

  return parts.length > 0 ? parts.join(", ") : null;
}
