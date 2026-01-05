import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

/**
 * GET /api/flyers?limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return errJson(
        "Supabase admin NÃO configurado. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env",
        null,
        500
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50") || 50, 200);
    const offset = Number(searchParams.get("offset") ?? "0") || 0;

    const { data, error } = await supabaseAdmin
      .from("flyers")
      .select("*")
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return errJson("Erro ao buscar flyers", error, 500);

    return NextResponse.json({
      success: true,
      count: data?.length ?? 0,
      limit,
      offset,
      flyers: data ?? [],
    });
  } catch (err: any) {
    console.error("GET /api/flyers error:", err);
    return errJson("Erro inesperado ao buscar flyers", err, 500);
  }
}

/**
 * POST /api/flyers
 * body:
 * { prompt, from, brand, format, title? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return errJson(
        "Supabase admin NÃO configurado. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env",
        null,
        500
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt = body?.prompt;
    const from = body?.from || "site";
    const brand = body?.brand || "Confi Seguros";
    const format = body?.format || "instagram_feed";
    const title = body?.title || null;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return errJson("Prompt é obrigatório (mínimo 3 caracteres)", null, 400);
    }

    const insertPayload: any = {
      prompt: prompt.trim(),
      from_source: from,
      brand,
      format,
      status: "AGUARDANDO_APROVACAO",
    };

    if (title) insertPayload.title = title;

    const { data, error } = await supabaseAdmin
      .from("flyers")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) return errJson("Erro ao criar flyer", error, 500);

    return NextResponse.json({ success: true, flyer: data });
  } catch (err: any) {
    console.error("POST /api/flyers error:", err);
    return errJson("Erro inesperado ao criar flyer", err, 500);
  }
}
