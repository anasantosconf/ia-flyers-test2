import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import path from "path";
import fs from "fs/promises";

function stripBase64Prefix(base64: string) {
  // remove "data:image/png;base64," se vier
  return base64.replace(/^data:image\/\w+;base64,/, "");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase não configurado" },
        { status: 500 }
      );
    }

    const body = await req.json();

    /**
     * Você pode mandar:
     * {
     *   "imageBase64": "...",
     *   "format": "png"
     * }
     *
     * OU:
     * {
     *   "imageUrl": "https://....png"
     * }
     */

    let imageBuffer: Buffer | null = null;

    // ✅ Caso 1: veio base64
    if (body.imageBase64) {
      const cleanBase64 = stripBase64Prefix(body.imageBase64);
      imageBuffer = Buffer.from(cleanBase64, "base64");
    }

    // ✅ Caso 2: veio URL
    if (!imageBuffer && body.imageUrl) {
      const res = await fetch(body.imageUrl);
      if (!res.ok) throw new Error("Não foi possível baixar imageUrl");
      const arrayBuffer = await res.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: "Envie imageBase64 ou imageUrl" },
        { status: 400 }
      );
    }

    // ✅ nome do arquivo
    const ext = body.format || "png";
    const fileName = `flyer-${id}.${ext}`;

    // ✅ salvar em /public/generated/
    const generatedDir = path.join(process.cwd(), "public", "generated");
    await fs.mkdir(generatedDir, { recursive: true });

    const filePath = path.join(generatedDir, fileName);
    await fs.writeFile(filePath, imageBuffer);

    // ✅ URL pública (Vercel/Next serve /public automaticamente)
    const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/generated/${fileName}`;

    // ✅ atualiza supabase (você pode trocar o nome do campo se quiser)
    const { data, error } = await supabaseAdmin
      .from("flyers")
      .update({
        drive_url: publicUrl, // aqui usamos drive_url como "public image url"
        status: "GERADO",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      flyer: data,
      publicUrl,
    });
  } catch (err) {
    console.error("upload-image error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Erro interno" },
      { status: 500 }
    );
  }
}
