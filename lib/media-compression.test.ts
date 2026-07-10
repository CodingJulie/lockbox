import { describe, it, expect } from "vitest";
import {
  isCompressibleImage,
  getRecorderOptions,
  getRecorderMimeCandidates,
  pickSmallestEncoded,
  VIDEO_BITS_PER_SECOND,
  AUDIO_BITS_PER_SECOND,
} from "@/lib/media-compression";
import { FFMPEG_MIN_SIZE_BYTES, shouldCompressVideoWithFfmpeg } from "@/lib/video-compression";
import { getMediaConstraints } from "@/lib/media-permissions";

describe("isCompressibleImage", () => {
  it("accepts common photo types", () => {
    expect(isCompressibleImage(new Blob([], { type: "image/jpeg" }))).toBe(true);
    expect(isCompressibleImage(new Blob([], { type: "image/png" }))).toBe(true);
    expect(isCompressibleImage(new Blob([], { type: "image/webp" }))).toBe(true);
  });

  it("skips animated and vector images", () => {
    expect(isCompressibleImage(new Blob([], { type: "image/gif" }))).toBe(false);
    expect(isCompressibleImage(new Blob([], { type: "image/svg+xml" }))).toBe(false);
  });

  it("skips non-images", () => {
    expect(isCompressibleImage(new Blob([], { type: "video/mp4" }))).toBe(false);
    expect(isCompressibleImage(new Blob([], { type: "application/pdf" }))).toBe(false);
  });
});

describe("getRecorderMimeCandidates", () => {
  it("prefers MP4 first on Safari for video", () => {
    const candidates = getRecorderMimeCandidates("video", "safari");
    expect(candidates[0]).toBe("video/mp4");
  });

  it("prefers WebM VP9 first on Chrome for video", () => {
    const candidates = getRecorderMimeCandidates("video", "chrome");
    expect(candidates[0]).toBe("video/webm;codecs=vp9,opus");
  });

  it("prefers MP4 first on Safari for audio", () => {
    const candidates = getRecorderMimeCandidates("audio", "safari");
    expect(candidates[0]).toBe("audio/mp4");
  });
});

describe("pickSmallestEncoded", () => {
  it("picks the smallest blob among supported formats", () => {
    const result = pickSmallestEncoded([
      { blob: new Blob(["12345"], { type: "image/jpeg" }), ext: "jpg" },
      { blob: new Blob(["12"], { type: "image/webp" }), ext: "webp" },
      null,
    ]);
    expect(result.ext).toBe("webp");
    expect(result.blob.size).toBe(2);
  });

  it("throws when no format is supported", () => {
    expect(() => pickSmallestEncoded([null, null])).toThrow("Compression failed");
  });
});

describe("getRecorderOptions", () => {
  it("sets video and audio bitrates for video recording", () => {
    expect(getRecorderOptions("video/webm;codecs=vp9,opus", "video")).toEqual({
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
  });

  it("sets audio bitrate only for audio recording", () => {
    expect(getRecorderOptions("audio/webm;codecs=opus", "audio")).toEqual({
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
  });
});

describe("shouldCompressVideoWithFfmpeg", () => {
  it("requires files above 10 MB", () => {
    const small = new File(["x"], "clip.mp4", {
      type: "video/mp4",
    });
    Object.defineProperty(small, "size", { value: FFMPEG_MIN_SIZE_BYTES });

    expect(shouldCompressVideoWithFfmpeg(small)).toBe(false);
  });

  it("accepts large video MIME types", () => {
    const large = new File(["x"], "clip.mp4", {
      type: "video/mp4",
    });
    Object.defineProperty(large, "size", {
      value: FFMPEG_MIN_SIZE_BYTES + 1,
    });

    expect(shouldCompressVideoWithFfmpeg(large)).toBe(true);
  });

  it("accepts large files by extension when MIME is missing", () => {
    const large = new File(["x"], "clip.mov", { type: "" });
    Object.defineProperty(large, "size", {
      value: FFMPEG_MIN_SIZE_BYTES + 1,
    });

    expect(shouldCompressVideoWithFfmpeg(large)).toBe(true);
  });

  it("skips large non-video files", () => {
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    Object.defineProperty(pdf, "size", {
      value: FFMPEG_MIN_SIZE_BYTES + 1,
    });

    expect(shouldCompressVideoWithFfmpeg(pdf)).toBe(false);
  });
});

describe("getMediaConstraints", () => {
  it("caps video at 480p and lower frame rate", () => {
    const constraints = getMediaConstraints("video");
    expect(constraints.video).toMatchObject({
      width: { ideal: 854 },
      height: { ideal: 480 },
      frameRate: { ideal: 15, max: 24 },
    });
  });
});
