import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "evidence";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export async function uploadSupabase(
  storagePath: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, data, { contentType, upsert: true });

  if (error) throw error;
}

export async function downloadSupabase(storagePath: string): Promise<Buffer> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);

  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteSupabase(storagePath: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  await supabase.storage.from(BUCKET).remove([storagePath]);
}
