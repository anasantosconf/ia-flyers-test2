import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadPngToSupabaseStorage(params: {
  supabaseAdmin: SupabaseClient;
  bucket: string;
  path: string;            // ex: generated/flyer-<id>.png
  buffer: Buffer;
  upsert?: boolean;
}) {
  const { supabaseAdmin, bucket, path, buffer, upsert = true } = params;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert,
      cacheControl: "3600",
    });

  if (error) throw error;

  // URL pública (bucket precisa ser public)
  const { data: publicData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(path);

  return {
    storage_path: data.path,
    public_url: publicData.publicUrl,
  };
}
