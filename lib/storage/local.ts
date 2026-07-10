import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "files");

async function ensureDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function uploadLocal(storagePath: string, data: Buffer): Promise<void> {
  const fullPath = path.join(DATA_DIR, storagePath);
  await ensureDir(fullPath);
  await writeFile(fullPath, data);
}

export async function downloadLocal(storagePath: string): Promise<Buffer> {
  const fullPath = path.join(DATA_DIR, storagePath);
  return readFile(fullPath);
}

export async function deleteLocal(storagePath: string): Promise<void> {
  const fullPath = path.join(DATA_DIR, storagePath);
  try {
    await unlink(fullPath);
  } catch {
    // file may not exist
  }
}
