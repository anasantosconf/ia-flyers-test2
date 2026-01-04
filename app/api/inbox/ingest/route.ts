import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      channel = "unknown",
      from_name,
      from_phone,
      from_id,
      text,
      external_id,
      raw,
    } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text é obrigatório" }, { status: 400 });
    }

    // evitar duplicados
    if (external_id) {
      const { data: existing } = await supabaseAdmin
        .from("inbox_messages")
        .select("id")
        .eq("channel", channel)
        .eq("external_id", external_id)
        .maybeSingle();

      if (existing?.id) {
        return NextResponse.json({ success: true, duplicated: true, id: existing.id });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("inbox_messages")
      .insert([
        {
          channel,
          from_name: from_name || null,
          from_phone: from_phone || null,
          from_id: from_id || null,
          text,
          external_id: external_id || null,
          raw: raw || null,
          processed: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, inbox: data });
  } catch (err) {
    console.error("inbox/ingest error:", err);
    return NextResponse.json({ error: "Erro ao salvar inbox" }, { status: 500 });
  }
}

// GET opcional (útil para debug — pode deixar)
export async function GET() {
  return NextResponse.json({ ok: true, msg: "inbox ingest is alive" });
}
