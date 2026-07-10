import type { MediaKind, MediaEnvironment } from "@/lib/media-permissions";

/** Max longest edge for uploaded photos (px) */
export const MAX_IMAGE_DIMENSION = 1280;

/** Quality for photo re-encoding (0–1), used for AVIF / WebP / JPEG */
export const IMAGE_QUALITY = 0.7;

/** Encoded in priority order; smallest result wins */
export const IMAGE_OUTPUT_FORMATS = [
  { mime: "image/avif", ext: "avif" },
  { mime: "image/webp", ext: "webp" },
  { mime: "image/jpeg", ext: "jpg" },
] as const;

/** Target bitrates for in-browser recording */
export const VIDEO_BITS_PER_SECOND = 500_000;
export const AUDIO_BITS_PER_SECOND = 64_000;

const VIDEO_MIME_CANDIDATES_DEFAULT = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
  "video/mp4;codecs=avc1,mp4a.40.2",
] as const;

const VIDEO_MIME_CANDIDATES_SAFARI = [
  "video/mp4",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/webm;codecs=vp9,opus",
  "video/webm",
] as const;

const AUDIO_MIME_CANDIDATES_DEFAULT = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/ogg;codecs=opus",
] as const;

const AUDIO_MIME_CANDIDATES_SAFARI = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
] as const;

export function getRecorderMimeCandidates(
  kind: MediaKind,
  browser: MediaEnvironment["browser"] = "other"
): readonly string[] {
  const preferMp4 = browser === "safari";
  if (kind === "video") {
    return preferMp4 ? VIDEO_MIME_CANDIDATES_SAFARI : VIDEO_MIME_CANDIDATES_DEFAULT;
  }
  return preferMp4 ? AUDIO_MIME_CANDIDATES_SAFARI : AUDIO_MIME_CANDIDATES_DEFAULT;
}

export function pickRecorderMimeType(
  kind: MediaKind,
  browser: MediaEnvironment["browser"] = "other"
): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;

  for (const mime of getRecorderMimeCandidates(kind, browser)) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

export type UploadPrepareProgress = {
  phase: "video-loading" | "video-compressing";
  ratio: number;
};

export function isCompressibleImage(file: Blob): boolean {
  const type = file.type.toLowerCase();
  if (!type.startsWith("image/")) return false;
  if (type === "image/gif" || type === "image/svg+xml") return false;
  return true;
}

export function pickSmallestEncoded(results: Array<{ blob: Blob; ext: string } | null>): {
  blob: Blob;
  ext: string;
} {
  const valid = results.filter((result): result is { blob: Blob; ext: string } => result !== null);
  if (valid.length === 0) throw new Error("Compression failed");
  return valid.reduce((best, current) => (current.blob.size < best.blob.size ? current : best));
}

export function getRecorderOptions(
  mimeType: string | undefined,
  kind: MediaKind
): MediaRecorderOptions {
  const options: MediaRecorderOptions = {};
  if (mimeType) options.mimeType = mimeType;
  if (kind === "video") {
    options.videoBitsPerSecond = VIDEO_BITS_PER_SECOND;
    options.audioBitsPerSecond = AUDIO_BITS_PER_SECOND;
  } else {
    options.audioBitsPerSecond = AUDIO_BITS_PER_SECOND;
  }
  return options;
}

export async function prepareFileForUpload(
  file: File,
  onProgress?: (progress: UploadPrepareProgress) => void
): Promise<{ blob: Blob; filename: string }> {
  if (isCompressibleImage(file)) {
    try {
      const compressed = await compressImage(file);
      if (compressed.blob.size < file.size) {
        return compressed;
      }
    } catch {
      // Browser can't decode this format — upload original
    }
    return { blob: file, filename: file.name };
  }

  const { shouldCompressVideoWithFfmpeg, compressVideoWithFfmpeg } =
    await import("@/lib/video-compression");

  if (shouldCompressVideoWithFfmpeg(file)) {
    try {
      const compressed = await compressVideoWithFfmpeg(file, (progress) => {
        onProgress?.({
          phase: progress.phase === "loading" ? "video-loading" : "video-compressing",
          ratio: progress.ratio,
        });
      });
      if (compressed.blob.size < file.size) {
        return compressed;
      }
    } catch (error) {
      console.warn("Video compression failed, uploading original:", error);
    }
  }

  return { blob: file, filename: file.name };
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mime, IMAGE_QUALITY);
  });
}

async function encodeCanvasBest(canvas: HTMLCanvasElement): Promise<{ blob: Blob; ext: string }> {
  const results = await Promise.all(
    IMAGE_OUTPUT_FORMATS.map(async ({ mime, ext }) => {
      const blob = await canvasToBlob(canvas, mime);
      return blob ? { blob, ext } : null;
    })
  );
  return pickSmallestEncoded(results);
}

async function compressImage(file: File): Promise<{ blob: Blob; filename: string }> {
  const bitmap = await createImageBitmap(file);

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / longest);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(bitmap, 0, 0, width, height);

    const { blob, ext } = await encodeCanvasBest(canvas);
    const baseName = file.name.replace(/\.[^.]+$/, "") || file.name;
    return { blob, filename: `${baseName}.${ext}` };
  } finally {
    bitmap.close();
  }
}
