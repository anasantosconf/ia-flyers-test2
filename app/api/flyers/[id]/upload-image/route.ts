import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadPngToSupabaseStorage } from "@/lib/storage";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
const isDev = process.env.NODE_ENV !== "production";

function errJson(message: string, err?: any, status = 500) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(isDev && err
        ? {
            debug: {
              message: err?.message,
              details: err?.details,
              hint: err?.hint,
              code: err?.code,
              status: err?.status,
              stack: err?.stack,
            },
          }
        : {}),
    },
    { status }
  );
}

function getFlyerIdFromUrl(req: NextRequest): string | null {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const flyersIndex = parts.indexOf("flyers");
  if (flyersIndex === -1) return null;
  return parts[flyersIndex + 1] ?? null;
}

/**
 * POST /api/flyers/:id/upload-image
 * body:
 * {
 *   relative_path?: "/generated/flyer-<id>.png"
 * }
 *
 * Esse endpoint agora:
 * - lê o arquivo do disco local (runtime)
 * - faz upload pro Supabase Storage
 * - salva image_url = URL pública do Storage
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return errJson("Supabase admin NÃO configurado", null, 500);

    const flyerId = getFlyerIdFromUrl(req);
    if (!flyerId) return errJson("Não foi possível extrair flyerId da URL", null, 400);

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "flyers";
    const prefix = process.env.SUPABASE_STORAGE_PREFIX || "generated";

    const body = await req.json().catch(() => ({}));
    const relativePath = body?.relative_path || `/generated/flyer-${flyerId}.png`;

    // Caminho físico do arquivo no projeto (App Router rodando em nodejs)
    const filePath = path.join(process.cwd(), "public", relativePath.replace(/^\/+/, ""));

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (readErr: any) {
      return errJson(
        "Não consegui ler o arquivo local. Verifique se ele existe em /public/generated.",
        { filePath, message: readErr?.message },
        404
      );
    }

    // Upload para Supabase Storage
    const storagePath = `${prefix}/flyer-${flyerId}.png`;

    const { public_url } = await uploadPngToSupabaseStorage({
      supabaseAdmin,
      bucket,
      path: storagePath,
      buffer: fileBuffer,
      upsert: true,
    });

    // Atualiza Supabase DB
    const { data: updatedRows, error: updateErr } = await supabaseAdmin
      .from("flyers")
      .update({
        image_url: public_url,
        status: "IMAGE_READY",
      })
      .eq("id", flyerId)
      .select("id,image_url,status");

    if (updateErr) return errJson("Erro ao salvar image_url no Supabase", updateErr, 500);

    const updated = updatedRows?.[0];

    return NextResponse.json({
      success: true,
      id: flyerId,
      image_url: updated?.image_url ?? public_url,
      status: updated?.status ?? "IMAGE_READY",
      supabaseUpdated: true,
      storage: {
        bucket,
        path: storagePath,
      },
    });
  } catch (err: any) {
    console.error("POST /upload-image error:", err);
    return errJson("Erro inesperado no upload-image", err, 500);
  }
}

