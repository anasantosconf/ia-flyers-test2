import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { ok: false, error: "Supabase não configurado (env vars ausentes)" },
        { status: 500 }
      );
    }

    const body = await req.json();

    // ✅ normalização: aceita várias formas
    const channel = body.channel || "whatsapp";
    const from_name = body.from_name || null;

    // telefone pode vir em from_phone OU from_id (se você mandou telefone no from_id)
    const from_phone = body.from_phone || body.from_id || null;

    // id externo real (se existir)
    const from_id = body.from_id || null;

    const text = body.text;
    const external_id = body.external_id || null;

    // ✅ validação mínima
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Campo 'text' é obrigatório" },
        { status: 400 }
      );
    }

    const payloadToInsert = {
      channel,
      from_name,
      from_phone,
      from_id,
      external_id,
      text,
      raw: body, // guarda tudo que veio
      processed: false,
    };

    const { data, error } = await supabaseAdmin
      .from("inbox_messages")
      .insert([payloadToInsert])
      .select()
      .single();

    if (error) {
      console.error("inbox ingest supabase error:", error);
      return NextResponse.json(
        { ok: false, error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, msg: "POST ok", inserted: data });
  } catch (err) {
    console.error("inbox ingest error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message || "Erro interno" },
      { status: 500 }
    );
  }
}
