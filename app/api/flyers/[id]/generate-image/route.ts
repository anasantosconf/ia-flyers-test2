import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// 1x1 PNG transparente (base64)
const MOCK_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBApX0WZkAAAAASUVORK5CYII=";

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

    const url = new URL(req.url);
    const mock = url.searchParams.get("mock") === "true";

    // 1) Buscar flyer
    const { data: flyer, error: flyerError } = await supabaseAdmin
      .from("flyers")
      .select("*")
      .eq("id", id)
      .single();

    if (flyerError || !flyer) {
      return NextResponse.json(
        { error: "Flyer não encontrado" },
        { status: 404 }
      );
    }

    // 2) Se mock, não chama OpenAI
    if (mock) {
      const { data: updatedFlyer, error: updateError } = await supabaseAdmin
        .from("flyers")
        .update({
          preview_base64: MOCK_BASE64,
          status: "GERADO",
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        mock: true,
        flyer: updatedFlyer,
      });
    }

    // 3) Modo real (OpenAI)
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://ia-flyers-test2.vercel.app";

    const resp = await fetch(`${baseUrl}/api/generateFlyerImage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: flyer.prompt,
        brand: flyer.brand,
        format: flyer.format,
      }),
    });

    const result = await resp.json();

    if (!resp.ok || !result?.previewBase64) {
      return NextResponse.json(
        { error: result?.error || "Erro ao gerar imagem" },
        { status: 500 }
      );
    }

    const previewBase64 = result.previewBase64;

    const { data: updatedFlyer, error: updateError } = await supabaseAdmin
      .from("flyers")
      .update({
        preview_base64: previewBase64,
        status: "GERADO",
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      mock: false,
      flyer: updatedFlyer,
    });
  } catch (err) {
    console.error("generate-image error:", err);
    return NextResponse.json(
      { error: "Erro interno ao gerar imagem do flyer" },
      { status: 500 }
    );
  }
}
