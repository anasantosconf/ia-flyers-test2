import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("flyers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/flyers error:", err);
    return NextResponse.json({ error: "Erro ao buscar flyers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const prompt = body.prompt;
    const from = body.from || "site";
    const brand = body.brand || "Confi Seguros";
    const format = body.format || "instagram_feed";
    const previewBase64 = body.previewBase64 || null;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt é obrigatório" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("flyers")
      .insert([
        {
          prompt,
          from_source: from,
          brand,
          format,
          status: "AGUARDANDO_APROVACAO",
          preview_base64: previewBase64,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, flyer: data });
  } catch (err) {
    console.error("POST /api/flyers error:", err);
    return NextResponse.json({ error: "Erro ao criar flyer" }, { status: 500 });
  }
}
