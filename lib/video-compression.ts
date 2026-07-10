import type { FFmpeg } from "@ffmpeg/ffmpeg";

/** Only compress uploads larger than this threshold */
export const FFMPEG_MIN_SIZE_BYTES = 10 * 1024 * 1024;

const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CDN_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|m4v|3gp)$/i;

export type VideoCompressionProgress = {
  phase: "loading" | "compressing";
  ratio: number;
};

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

export function shouldCompressVideoWithFfmpeg(file: File): boolean {
  if (file.size <= FFMPEG_MIN_SIZE_BYTES) return false;

  const type = file.type.toLowerCase();
  if (type.startsWith("video/")) return true;

  // Some mobile browsers omit MIME type for gallery picks
  return VIDEO_EXTENSIONS.test(file.name);
}

function getInputExtension(filename: string): string {
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match ? `.${match[1].toLowerCase()}` : ".mp4";
}

async function loadFfmpeg(
  onProgress?: (progress: VideoCompressionProgress) => void
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    onProgress?.({ phase: "loading", ratio: 0 });

    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");

    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CDN_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CDN_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegInstance = ffmpeg;
    onProgress?.({ phase: "loading", ratio: 1 });
    return ffmpeg;
  })();

  try {
    return await ffmpegLoadPromise;
  } catch (error) {
    ffmpegLoadPromise = null;
    throw error;
  }
}

export async function compressVideoWithFfmpeg(
  file: File,
  onProgress?: (progress: VideoCompressionProgress) => void
): Promise<{ blob: Blob; filename: string }> {
  const ffmpeg = await loadFfmpeg(onProgress);

  const inputName = `input${getInputExtension(file.name)}`;
  const outputName = "output.mp4";

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.({
      phase: "compressing",
      ratio: Math.min(1, Math.max(0, progress)),
    });
  };

  ffmpeg.on("progress", progressHandler);

  try {
    const { fetchFile } = await import("@ffmpeg/util");
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const exitCode = await ffmpeg.exec([
      "-i",
      inputName,
      "-c:v",
      "libx264",
      "-crf",
      "28",
      "-preset",
      "fast",
      "-vf",
      "scale=480:-2",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      "-movflags",
      "+faststart",
      outputName,
    ]);

    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with code ${exitCode}`);
    }

    const data = await ffmpeg.readFile(outputName);
    const blob =
      data instanceof Uint8Array
        ? new Blob([Uint8Array.from(data)], { type: "video/mp4" })
        : new Blob([String(data)], { type: "video/mp4" });

    const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
    return { blob, filename: `${baseName}-compressed.mp4` };
  } finally {
    ffmpeg.off("progress", progressHandler);
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // input may not exist if exec failed early
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // output may not exist if exec failed
    }
  }
}
