import { describe, expect, it } from "vitest";
import { summarizeVaultActivity } from "@/lib/vault-events";
import { formatActivityDate, formatVaultActivity } from "@/lib/vault-activity";

describe("summarizeVaultActivity", () => {
  it("keeps the latest login and counts the other actions", () => {
    const summary = summarizeVaultActivity([
      { action: "download", createdAt: "2026-03-04T00:00:00.000Z" },
      { action: "login", createdAt: "2026-03-03T12:00:00.000Z" },
      { action: "login", createdAt: "2026-03-01T12:00:00.000Z" },
      { action: "upload", createdAt: "2026-03-02T00:00:00.000Z" },
      { action: "download", createdAt: "2026-03-02T00:00:00.000Z" },
      { action: "verify_fail", createdAt: "2026-03-02T01:00:00.000Z" },
    ]);

    expect(summary).toEqual({
      lastLoginAt: "2026-03-03T12:00:00.000Z",
      downloads: 2,
      uploads: 1,
      failedVerifies: 1,
    });
  });
});

describe("formatVaultActivity", () => {
  it("formats last login and download count like the product copy", () => {
    const iso = "2026-03-03T12:00:00.000Z";
    const t = (key: string, options?: Record<string, unknown>) => {
      if (key === "activity.lastLogin") return `Был вход ${options?.date}`;
      if (key === "activity.downloads") return `${options?.count} скачивания`;
      return key;
    };

    expect(
      formatVaultActivity(
        { lastLoginAt: iso, downloads: 2, uploads: 0, failedVerifies: 0 },
        t,
        "ru"
      )
    ).toBe(`Был вход ${formatActivityDate(iso, "ru")}, 2 скачивания`);
  });

  it("returns null when there is nothing to show", () => {
    const t = (key: string) => key;
    expect(
      formatVaultActivity(
        { lastLoginAt: null, downloads: 0, uploads: 0, failedVerifies: 0 },
        t,
        "ru"
      )
    ).toBeNull();
  });
});
