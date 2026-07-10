import { describe, expect, it } from "vitest";
import integrity from "@/lib/ffmpeg-integrity.json";
import { sha256HexOfBuffer } from "@/lib/video-compression";

describe("ffmpeg integrity", () => {
  it("pins 64-character SHA-256 hashes for the self-hosted core", () => {
    expect(integrity.version).toBe("0.12.10");
    expect(integrity.coreJs).toMatch(/^[a-f0-9]{64}$/);
    expect(integrity.coreWasm).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes buffers the same way the loader checks CDN-free files", async () => {
    const bytes = new TextEncoder().encode("lockbox-ffmpeg");
    await expect(sha256HexOfBuffer(bytes.buffer)).resolves.toMatch(/^[a-f0-9]{64}$/);
  });
});
