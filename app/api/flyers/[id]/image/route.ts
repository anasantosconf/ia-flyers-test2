import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
    }

    const { data: flyer, error } = await supabaseAdmin
      .from("flyers")
      .select("id, preview_base64")
      .eq("id", id)
      .single();

    if (error || !flyer) {
      return NextResponse.json({ error: "Flyer não encontrado" }, { status: 404 });
    }

    if (!flyer.preview_base64) {
      return NextResponse.json({ error: "Flyer ainda não tem imagem" }, { status: 400 });
    }

    const buffer = Buffer.from(flyer.preview_base64, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/flyers/[id]/image error:", err);
    return NextResponse.json({ error: "Erro ao gerar imagem" }, { status: 500 });
  }
}
