import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { pickLogo, BrandFolder } from "@/lib/logos";
import { overlayLogoOnImage } from "@/lib/overlayLogo";

export const runtime = "nodejs";

function brandToFolder(brand: string | null): BrandFolder {
  const b = (brand || "").toLowerCase();
  if (b.includes("benef")) return "beneficios";
  if (b.includes("finan")) return "financas";
  if (b.includes("seguro")) return "seguros";
  return "geral";
}

function getIdFromUrl(req: NextRequest) {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const i = parts.indexOf("flyers");
  return i >= 0 ? parts[i + 1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Supabase admin não configurado" },
        { status: 500 }
      );
    }

    const id = getIdFromUrl(req);
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID inválido" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const force = Boolean(body.force);

    // 1) Busca flyer (brand, format etc)
    const { data: flyer, error: fetchErr } = await supabaseAdmin
      .from("flyers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!flyer) {
      return NextResponse.json(
        { success: false, error: "Flyer não encontrado" },
        { status: 404 }
      );
    }

    // se já tem image_url e não for force, só retorna
    if (flyer.image_url && !force) {
      return NextResponse.json({
        success: true,
        id,
        image_url: flyer.image_url,
        status: flyer.status,
        supabaseUpdated: false,
        alreadyUploaded: true,
      });
    }

    // 2) Caminho do PNG gerado localmente
    const localPath =
      body.relative_path
        ? path.join(process.cwd(), "public", body.relative_path.replace(/^\//, ""))
        : path.join(process.cwd(), "public", "generated", `flyer-${id}.png`);

    // valida existência
    try {
      await fs.access(localPath);
    } catch {
      return NextResponse.json(
        { success: false, error: "Arquivo PNG não encontrado no disco", localPath },
        { status: 400 }
      );
    }

    // 3) Aplicar logo em um arquivo temporário
    const brandFolder = brandToFolder(flyer.brand);
    const format = flyer.format || "instagram_feed";

    // background:
    // - se flyer foi gerado por IA em foto -> melhor assumir "photo"
    // depois podemos melhorar com detector de luminância
    const background = "photo" as const;

    const picked = pickLogo({
      brand: brandFolder,
      background,
      format,
      preferColor: true,
    });

    const withLogoPath = path.join(process.cwd(), "public", "generated", `flyer-${id}-final.png`);

    if (picked) {
      await overlayLogoOnImage({
        inputPath: localPath,
        outputPath: withLogoPath,
        logoPublicPath: picked.path,
        position: "top-right",
        marginPct: 0.05,
        logoWidthPct: 0.22,
      });
    } else {
      // se não achou logo, usa o original
      await fs.copyFile(localPath, withLogoPath);
    }

    const fileBuffer = await fs.readFile(withLogoPath);

    // 4) Upload pro Supabase Storage
    const storagePath = `generated/flyer-${id}.png`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("flyers")
      .upload(storagePath, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // URL pública
    const { data: pub } = supabaseAdmin.storage.from("flyers").getPublicUrl(storagePath);
    const imageUrl = pub.publicUrl;

    // 5) Atualiza o flyer
    const { error: updateErr } = await supabaseAdmin
      .from("flyers")
      .update({
        image_url: imageUrl,
        status: "IMAGE_READY",
      })
      .eq("id", id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      id,
      image_url: imageUrl,
      status: "IMAGE_READY",
      supabaseUpdated: true,
      logoApplied: Boolean(picked),
      logo: picked,
      storage: {
        bucket: "flyers",
        path: storagePath,
      },
    });
  } catch (err: any) {
    console.error("POST /upload-image error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao fazer upload com logo",
        debug: {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
        },
      },
      { status: 500 }
    );
  }
}
