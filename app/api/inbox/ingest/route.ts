import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // ✅ Se env vars não existem no Vercel, a gente vê já
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase não configurado (env vars ausentes)",
          hint: "Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel (Production).",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const channel = body.channel || "whatsapp";
    const from_name = body.from_name || null;
    const from_id = body.from_id || null;
    const external_id = body.external_id || null;
    const text = body.text;

    // opcional: payload bruto para auditoria
    const raw = body.raw || body || null;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { ok: false, error: "Campo 'text' é obrigatório" },
        { status: 400 }
      );
    }

    // ✅ Sua tabela tem os 2: from_id e from_phone
    // Para WhatsApp, normalmente o from_id é o telefone.
    const from_phone =
      channel === "whatsapp" ? (from_id || body.from_phone || null) : (body.from_phone || null);

    const payload = {
      channel,
      from_name,
      from_id,
      from_phone,
      external_id,
      text,
      raw,
      processed: false,
    };

    const { data, error } = await supabaseAdmin
      .from("inbox_messages")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, msg: "POST ok", row: data });
  } catch (err) {
    console.error("inbox ingest error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: (err as any)?.message || "Erro interno no servidor",
      },
      { status: 500 }
    );
  }
}
