import { describe, expect, it } from "vitest";
import { buildZipStore, crc32 } from "@/lib/zip";

describe("zip store", () => {
  it("computes the known CRC-32 of '123456789'", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("builds a ZIP with local headers and an end-of-central-directory record", () => {
    const zip = buildZipStore([{ name: "manifest.json", data: new TextEncoder().encode("{}") }]);
    const asString = new TextDecoder("latin1").decode(zip);
    expect(asString.startsWith("PK")).toBe(true);
    expect(asString).toContain("manifest.json");
    expect(asString).toContain("{}");
    expect(zip[zip.byteLength - 22]).toBe(0x50);
    expect(zip[zip.byteLength - 21]).toBe(0x4b);
  });
});
