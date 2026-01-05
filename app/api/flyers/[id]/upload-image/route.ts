import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadPngToSupabaseStorage } from "@/lib/storage";
import { pickLogo, BrandFolder } from "@/lib/logos";
import { overlayLogoOnBuffer } from "@/lib/overlayLogoBuffer";
import { detectCornerBg } from "@/lib/detectBg";

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

function base64ToBuffer(base64: string): Buffer {
  const cleaned = base64.includes("base64,") ? base64.split("base64,")[1] : base64;
  return Buffer.from(cleaned, "base64");
}

function brandToFolder(brand: string | null): BrandFolder {
  const b = (brand || "").toLowerCase();
  if (b.includes("benef")) return "beneficios";
  if (b.includes("finan")) return "financas";
  if (b.includes("seguro")) return "seguros";
  return "geral";
}

/**
 * POST /api/flyers/:id/upload-image
 *
 * - Busca flyer no Supabase
 * - Usa preview_base64 (gerado no /generate-image)
 * - Detecta fundo no canto (top-left)
 * - Escolhe logo correta (branca/preta/colorida)
 * - Cola logo (Sharp) com safe area
 * - Sobe pro Supabase Storage
 * - Salva image_url e status=IMAGE_READY
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return errJson("Supabase admin NÃO configurado", null, 500);

    const flyerId = getFlyerIdFromUrl(req);
    if (!flyerId) return errJson("Não foi possível extrair flyerId da URL", null, 400);

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "flyers";
    const prefix = process.env.SUPABASE_STORAGE_PREFIX || "generated";

    // 1) Busca flyer
    const { data: flyer, error: fetchErr } = await supabaseAdmin
      .from("flyers")
      .select("id, preview_base64, image_url, status, brand, format")
      .eq("id", flyerId)
      .maybeSingle();

    if (fetchErr) return errJson("Erro ao buscar flyer no Supabase", fetchErr, 500);
    if (!flyer) return errJson("Flyer não encontrado", null, 404);

    // 2) body: force
    const body = await req.json().catch(() => ({}));
    const force = Boolean(body?.force);

    if (flyer.image_url && !force) {
      return NextResponse.json({
        success: true,
        id: flyerId,
        image_url: flyer.image_url,
        status: flyer.status ?? null,
        supabaseUpdated: false,
        alreadyUploaded: true,
      });
    }

    if (!flyer.preview_base64) {
      return errJson("Flyer não tem preview_base64. Rode /generate-image antes.", null, 400);
    }

    // 3) base64 -> buffer
    let buffer: Buffer;
    try {
      buffer = base64ToBuffer(flyer.preview_base64);
    } catch (e: any) {
      return errJson("Falha ao converter preview_base64 em buffer", e, 400);
    }

    // 4) Detecta o fundo do canto onde a logo vai (top-left)
    const position = "top-left" as const;
    const detectedBg = await detectCornerBg({
      baseBuffer: buffer,
      corner: position,
    }); // "light" | "dark"

    // 5) Escolhe logo
    const brandFolder: BrandFolder = brandToFolder(flyer.brand);
    const format = (flyer.format || "instagram_feed") as any;

    const logoPicked = pickLogo({
      brand: brandFolder,
      background: detectedBg,
      format,
      preferColor: true,
    });

    // 6) Overlay (robusto com debug)
    let finalBuffer = buffer;
    let logoApplied = false;
    let overlayDebug: any = null;

    if (logoPicked?.path) {
      try {
        const res = await overlayLogoOnBuffer({
  baseBuffer: buffer,
  logoPublicPath: logoPicked.path,
  position: "top-left",
  marginPx: 56,
  logoWidthPct: 0.18,
  addBackdrop: false,
  debugDraw: true, // ✅ LIGADO
});


        finalBuffer = res.buffer;
        overlayDebug = res.debug;
        logoApplied = true;
      } catch (e: any) {
        console.warn("Logo overlay falhou, subindo original:", e?.message);
      }
    }

    // 7) Upload FINAL
    const version = Date.now();
    const storagePath = `${prefix}/flyer-${flyerId}-${version}.png`;


    const { public_url } = await uploadPngToSupabaseStorage({
      supabaseAdmin,
      bucket,
      path: storagePath,
      buffer: finalBuffer,
      upsert: true,
    });

    // 8) Atualiza DB
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
      logoApplied,
      logoPicked,
      backgroundDetected: detectedBg,
      overlayDebug, // ✅ te diz se trim foi usado, tamanho real, posição etc.
      storage: { bucket, path: storagePath },
    });
  } catch (err: any) {
    console.error("POST /upload-image error:", err);
    return errJson("Erro inesperado no upload-image", err, 500);
  }
}
