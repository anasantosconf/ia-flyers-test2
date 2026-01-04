import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      channel,
      from_name,
      from_id,
      text,
      external_id,
      raw,
    } = body;

    if (!channel || !text) {
      return NextResponse.json(
        { error: "channel e text são obrigatórios" },
        { status: 400 }
      );
    }

    // Salva no Supabase (inbox_messages)
    // Adapte os nomes das colunas conforme a sua tabela
    const { data, error } = await supabaseAdmin
      .from("inbox_messages")
      .insert([
        {
          channel,
          from_name: from_name || "desconhecido",
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
