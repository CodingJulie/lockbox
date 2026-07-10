import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const integrity = JSON.parse(readFileSync(join(root, "lib/ffmpeg-integrity.json"), "utf8"));
const srcDir = join(root, "node_modules/@ffmpeg/core/dist/umd");
const destDir = join(root, "public/ffmpeg");

const files = [
  { name: "ffmpeg-core.js", sha256: integrity.coreJs },
  { name: "ffmpeg-core.wasm", sha256: integrity.coreWasm },
];

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

mkdirSync(destDir, { recursive: true });

for (const file of files) {
  const src = join(srcDir, file.name);
  const dest = join(destDir, file.name);
  const actual = sha256File(src);
  if (actual !== file.sha256) {
    throw new Error(
      `ffmpeg ${file.name} hash mismatch (expected ${file.sha256}, got ${actual}). Pin @ffmpeg/core@${integrity.version}.`
    );
  }
  copyFileSync(src, dest);
}
