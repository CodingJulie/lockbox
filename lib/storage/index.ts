import { downloadLocal, uploadLocal, deleteLocal } from "./local";
import { downloadSupabase, uploadSupabase, deleteSupabase, isSupabaseConfigured } from "./supabase";

export async function uploadFile(
  storagePath: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    await uploadSupabase(storagePath, data, contentType);
  } else {
    await uploadLocal(storagePath, data);
  }
}

export async function downloadFile(storagePath: string): Promise<Buffer> {
  if (isSupabaseConfigured()) {
    return downloadSupabase(storagePath);
  }
  return downloadLocal(storagePath);
}

export async function deleteFile(storagePath: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await deleteSupabase(storagePath);
  } else {
    await deleteLocal(storagePath);
  }
}

export function getStorageMode(): "supabase" | "local" {
  return isSupabaseConfigured() ? "supabase" : "local";
}
