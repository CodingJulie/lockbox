import { describe, expect, it } from "vitest";
import { buildCourtManifest, buildHashList, sanitizeExportFilename } from "@/lib/court-export";

describe("court export helpers", () => {
  it("prefixes a safe filename and strips path characters", () => {
    expect(sanitizeExportFilename("../secret/pass?.jpg", 0)).toBe("001-_secret_pass_.jpg");
    expect(sanitizeExportFilename("", 4)).toBe("005-item-5");
  });

  it("builds a manifest with the trusted-time source", () => {
    const items = [
      {
        id: "a",
        path: "files/001-note.txt",
        type: "text" as const,
        size: 4,
        createdAt: "2026-01-01T00:00:00.000Z",
        sha256: "abc",
      },
    ];
    const manifest = buildCourtManifest(items, {
      iso: "2026-01-02T00:00:00.000Z",
      unix: 1767312000,
      source: "lockbox-runtime",
    });
    expect(manifest.format).toBe("lockbox-court-package-v1");
    expect(manifest.timeSource).toBe("lockbox-runtime");
    expect(buildHashList(items)).toBe("abc  files/001-note.txt\n");
  });
});
