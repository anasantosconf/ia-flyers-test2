import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/inbox/ingest" });
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase não configurado (env vars ausentes)" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const channel = body.channel || "whatsapp";
    const from_name = body.from_name ?? null;
    const from_id = body.from_id ?? null;
    const from_phone = body.from_phone ?? (from_id ?? null);
    const text = body.text || "";
    const external_id = body.external_id ?? null;

    if (!text) {
      return NextResponse.json({ error: "text é obrigatório" }, { status: 400 });
    }

    // ✅ 1) Insere/atualiza no Supabase (evita duplicidade por external_id)
    const { data: inserted, error: upsertError } = await supabaseAdmin
      .from("inbox_messages")
      .upsert(
        [
          {
            channel,
            from_name,
            from_id,
            from_phone,
            text,
            external_id,
            raw: body,
            processed: false,
          },
        ],
        { onConflict: "channel,external_id" }
      )
      .select()
      .single();

    if (upsertError) throw upsertError;

    // ✅ 2) Classifica com /api/chat (não quebra se falhar)
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

      if (baseUrl) {
        const chatRes = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        const chatData = await chatRes.json();
        const aiRaw = chatData.ai;

        let aiJson: any = null;
        try {
          aiJson = JSON.parse(aiRaw);
        } catch {
          aiJson = null;
        }

        // ✅ Se retornou JSON válido com tipo, salva na tabela
        if (aiJson?.tipo) {
          const summary =
            aiJson.tipo === "GERAR_POST_INSTAGRAM"
              ? "Pedido de criação de flyer/post para redes sociais."
              : aiJson.tipo === "ATIVIDADE_GERAL"
              ? "Pedido operacional/tarefa/anotação."
              : "Mensagem conversacional/consulta.";

          await supabaseAdmin
            .from("inbox_messages")
            .update({
              classification: aiJson.tipo,
              analysis_summary: summary,
            })
            .eq("id", inserted.id);
        }
      }
    } catch (err) {
      console.log("classification failed:", err);
    }

    return NextResponse.json({ ok: true, msg: "POST ok", inserted });
  } catch (err) {
    console.error("inbox ingest error:", err);
    return NextResponse.json(
      { error: "Erro ao inserir/classificar inbox message" },
      { status: 500 }
    );
  }
}
