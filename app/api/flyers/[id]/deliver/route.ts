import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type DeliverBody = {
  channel?: "whatsapp" | "google_chat";
  to?: string; // telefone ou id
  name?: string;
  message?: string;
  fileName?: string;
  makeWebhookUrl?: string; // opcional pra testar
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Next 16
) {
  try {
    const { id: flyerId } = await params;

    if (!flyerId) {
      return NextResponse.json({ error: "flyerId obrigatório" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase não configurado (env vars ausentes)" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as DeliverBody;

    const makeWebhookUrl =
      body.makeWebhookUrl || process.env.MAKE_DRIVE_WHATSAPP_WEBHOOK_URL;

    if (!makeWebhookUrl) {
      return NextResponse.json(
        { error: "MAKE_DRIVE_WHATSAPP_WEBHOOK_URL não configurado" },
        { status: 500 }
      );
    }

    // 1) Buscar flyer
    const { data: flyer, error: flyerError } = await supabase
      .from("flyers")
      .select("*")
      .eq("id", flyerId)
      .single();

    if (flyerError) throw flyerError;
    if (!flyer) {
      return NextResponse.json({ error: "Flyer não encontrado" }, { status: 404 });
    }

    if (!flyer.preview_base64) {
      return NextResponse.json(
        { error: "Flyer não possui preview_base64 para salvar/enviar" },
        { status: 400 }
      );
    }

    // Nome padrão do arquivo
    const fileName =
      body.fileName ||
      `flyer-${(flyer.brand || "confi")
        .toString()
        .toLowerCase()
        .replace(/\s+/g, "-")}-${flyer.id}.png`;

    // Mensagem padrão
    const message =
      body.message ||
      `Olá ${body.name || ""}! ✅ Seu flyer já está pronto.\n\nVou te enviar o link do Drive em seguida.`;

    // 2) Chamar Make para salvar no Drive + enviar WhatsApp
    const payload = {
      flyerId: flyer.id,
      brand: flyer.brand,
      format: flyer.format,
      prompt: flyer.prompt,

      imageBase64: flyer.preview_base64,
      fileName,

      sendTo: {
        channel: body.channel || "whatsapp",
        to: body.to,
        name: body.name,
      },

      message,
    };

    const makeRes = await fetch(makeWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const makeText = await makeRes.text();
    let makeJson: any = null;

    try {
      makeJson = JSON.parse(makeText);
    } catch {
      // resposta não-JSON
    }

    if (!makeRes.ok) {
      console.error("Make error:", makeRes.status, makeText);
      return NextResponse.json(
        {
          error: "Erro no Make (Drive/WhatsApp)",
          status: makeRes.status,
          details: makeJson || makeText,
        },
        { status: 500 }
      );
    }

    const driveUrl = makeJson?.drive_url || makeJson?.driveUrl || null;
    const fileId = makeJson?.file_id || makeJson?.fileId || null;
    const sent = makeJson?.sent ?? true;

    // 3) Atualizar flyer no Supabase
    const updateData: any = {
      status: "ENVIADO",
    };

    if (driveUrl) updateData.drive_url = driveUrl;

    const { data: updatedFlyer, error: updateErr } = await supabase
      .from("flyers")
      .update(updateData)
      .eq("id", flyerId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      ok: true,
      flyer: updatedFlyer,
      make: { driveUrl, fileId, sent },
    });
  } catch (err) {
    console.error("deliver flyer error:", err);
    return NextResponse.json(
      { error: "Erro ao salvar/enviar flyer" },
      { status: 500 }
    );
  }
}
